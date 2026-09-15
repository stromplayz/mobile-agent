import { tool } from "ai";
import { z } from "zod";
import { closeTerminalSession, createTerminalSession, execOnce, installTerminalPackage, sendTerminalInput, subscribeToTerminalRuntime, type TerminalStreamEvent } from "terminal-runtime";
import { createRecord, summarizeValue } from "@/modules/tools/built-in/shared";
import type { ToolExecutionRecord } from "@/core/types/app-state";

type TerminalToolFactoryParams = { onRecord?: (record: ToolExecutionRecord) => void; defaultCwd?: string; projectId?: string | null; };
const DEFAULT_CWD_FALLBACK = "/data/data/com.tecnicalbot.mobileagent/files";
function resolveCwd(input: { cwd?: string }, fallback?: string): string { return input.cwd ?? fallback ?? DEFAULT_CWD_FALLBACK; }

export function createTerminalExecTool({ onRecord, defaultCwd }: TerminalToolFactoryParams) {
  return tool({
    description: "Run a single shell command in the bundled terminal runtime. Returns stdout, stderr, and exitCode.",
    inputSchema: z.object({ command: z.string().min(1), cwd: z.string().optional(), timeoutMs: z.number().int().min(1000).max(300000).optional() }),
    execute: async ({ command, cwd, timeoutMs }) => {
      const inputSummary = summarizeValue({ command, cwd, timeoutMs });
      try {
        const result = await execOnce({ command, cwd: resolveCwd({ cwd }, defaultCwd), timeoutMs: timeoutMs ?? 30000 });
        onRecord?.(createRecord({ toolName: "terminal_exec", status: "completed", inputSummary, outputSummary: summarizeValue({ exitCode: result.exitCode, stdout: result.stdout.slice(0, 400) }) }));
        return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr, truncated: false };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onRecord?.(createRecord({ toolName: "terminal_exec", status: "failed", inputSummary, error: msg }));
        throw error;
      }
    },
  });
}

export function createTerminalInstallTool({ onRecord, defaultCwd }: TerminalToolFactoryParams) {
  return tool({
    description: "Install a software package using pkg or apt.",
    inputSchema: z.object({ pkg: z.string().min(1), cwd: z.string().optional() }),
    execute: async ({ pkg, cwd }) => {
      const inputSummary = summarizeValue({ pkg });
      try {
        const result = await installTerminalPackage({ pkg, cwd: resolveCwd({ cwd }, defaultCwd) });
        onRecord?.(createRecord({ toolName: "terminal_install", status: "completed", inputSummary, outputSummary: summarizeValue({ exitCode: result.exitCode }) }));
        return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onRecord?.(createRecord({ toolName: "terminal_install", status: "failed", inputSummary, error: msg }));
        throw error;
      }
    },
  });
}

export function createTerminalSessionCreateTool({ onRecord, defaultCwd }: TerminalToolFactoryParams) {
  return tool({
    description: "Create a persistent interactive terminal session. Returns a sessionId.",
    inputSchema: z.object({ name: z.string().optional(), cwd: z.string().optional() }),
    execute: async ({ name, cwd }) => {
      const inputSummary = summarizeValue({ name, cwd });
      try {
        const session = await createTerminalSession({ name: name ?? `agent-${Date.now()}`, cwd: resolveCwd({ cwd }, defaultCwd) });
        if (!session) throw new Error("Terminal runtime not available.");
        onRecord?.(createRecord({ toolName: "terminal_session_create", status: "completed", inputSummary, outputSummary: summarizeValue({ sessionId: session.id }) }));
        return { sessionId: session.id, name: session.name, cwd: session.cwd, shell: session.shell };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onRecord?.(createRecord({ toolName: "terminal_session_create", status: "failed", inputSummary, error: msg }));
        throw error;
      }
    },
  });
}

export function createTerminalSessionSendTool({ onRecord }: TerminalToolFactoryParams) {
  return tool({
    description: "Send input (stdin) to an existing terminal session. Include \\n to execute.",
    inputSchema: z.object({ sessionId: z.string().min(1), data: z.string() }),
    execute: async ({ sessionId, data }) => {
      const inputSummary = summarizeValue({ sessionId, dataPreview: data.slice(0, 100) });
      try {
        const result = await sendTerminalInput(sessionId, data);
        if (!result.ok) throw new Error(result.error ?? "Failed");
        onRecord?.(createRecord({ toolName: "terminal_session_send", status: "completed", inputSummary }));
        return { ok: true };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onRecord?.(createRecord({ toolName: "terminal_session_send", status: "failed", inputSummary, error: msg }));
        throw error;
      }
    },
  });
}

export function createTerminalSessionReadTool({ onRecord }: TerminalToolFactoryParams) {
  const buffers = new Map<string, { chunks: string[] }>();
  subscribeToTerminalRuntime((event: TerminalStreamEvent) => {
    if (event.type === "output") { const existing = buffers.get(event.sessionId) ?? { chunks: [] }; existing.chunks.push(event.data); buffers.set(event.sessionId, existing); }
  });
  return tool({
    description: "Read accumulated output from a terminal session since last read.",
    inputSchema: z.object({ sessionId: z.string().min(1), afterCursor: z.number().int().min(0).optional(), maxChars: z.number().int().min(100).max(50000).optional() }),
    execute: async ({ sessionId, afterCursor, maxChars }) => {
      const inputSummary = summarizeValue({ sessionId, afterCursor });
      try {
        const buf = buffers.get(sessionId);
        const cursor = afterCursor ?? 0;
        const chunks = buf?.chunks.slice(cursor) ?? [];
        const limit = maxChars ?? 8000;
        let joined = chunks.join("");
        let truncated = false;
        if (joined.length > limit) { joined = joined.slice(0, limit); truncated = true; }
        const nextCursor = cursor + chunks.length;
        onRecord?.(createRecord({ toolName: "terminal_session_read", status: "completed", inputSummary, outputSummary: summarizeValue({ chars: joined.length, nextCursor }) }));
        return { output: joined, cursor: nextCursor, truncated, eof: buf === undefined };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onRecord?.(createRecord({ toolName: "terminal_session_read", status: "failed", inputSummary, error: msg }));
        throw error;
      }
    },
  });
}

export function createTerminalSessionCloseTool({ onRecord }: TerminalToolFactoryParams) {
  return tool({
    description: "Close a terminal session and release its process.",
    inputSchema: z.object({ sessionId: z.string().min(1) }),
    execute: async ({ sessionId }) => {
      const inputSummary = summarizeValue({ sessionId });
      try {
        await closeTerminalSession(sessionId);
        onRecord?.(createRecord({ toolName: "terminal_session_close", status: "completed", inputSummary }));
        return { ok: true };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onRecord?.(createRecord({ toolName: "terminal_session_close", status: "failed", inputSummary, error: msg }));
        throw error;
      }
    },
  });
}

export function createTerminalTools(params: TerminalToolFactoryParams) {
  return {
    terminal_exec: createTerminalExecTool(params),
    terminal_install: createTerminalInstallTool(params),
    terminal_session_create: createTerminalSessionCreateTool(params),
    terminal_session_send: createTerminalSessionSendTool(params),
    terminal_session_read: createTerminalSessionReadTool(params),
    terminal_session_close: createTerminalSessionCloseTool(params),
  };
}
