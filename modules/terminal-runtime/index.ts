import { requireOptionalNativeModule } from "expo";
import type { NativeModule } from "expo";
import { Platform } from "react-native";

type TerminalRuntimeEvents = {
  onSessionOutput(event: { sessionId: string; data: string }): void;
  onSessionExit(event: { sessionId: string; exitCode: number }): void;
  onSessionError(event: { sessionId: string; message: string }): void;
  onBootstrapProgress(event: { percent: number }): void;
};

declare class TerminalRuntimeNativeModule extends NativeModule<TerminalRuntimeEvents> {
  execOnce(input: { cwd?: string; command: string; timeoutMs?: number; env?: Record<string, string> }): Promise<{ exitCode: number; stdout: string; stderr: string }>;
  bootstrapStatus(): Promise<{ ready: boolean; root: string; supported: boolean }>;
  installBootstrap(): Promise<{ ok: boolean; root?: string; message?: string; error?: string }>;
  createSession(input: { name?: string; cwd?: string; shell?: string; useBootstrap?: boolean }): Promise<{ id: string; name: string; cwd: string; shell: string; bootstrapReady: boolean }>;
  sendInput(input: { sessionId: string; data: string }): Promise<{ ok: boolean; error?: string }>;
  closeSession(input: { sessionId: string }): Promise<{ ok: boolean }>;
  listSessions(): Promise<Array<{ id: string; name: string; cwd: string; alive: boolean }>>;
  installPackage(input: { package: string; cwd?: string }): Promise<{ exitCode: number; stdout: string; stderr: string }>;
}

export type TerminalExecResult = { exitCode: number; stdout: string; stderr: string };
export type TerminalSessionInfo = { id: string; name: string; cwd: string; shell: string; bootstrapReady: boolean };
export type TerminalBootstrapStatus = { ready: boolean; root: string; supported: boolean };
export type TerminalStreamEvent =
  | { type: "output"; sessionId: string; data: string }
  | { type: "exit"; sessionId: string; exitCode: number }
  | { type: "error"; sessionId: string; message: string }
  | { type: "bootstrapProgress"; percent: number };

const TerminalRuntime = Platform.OS === "android" ? (requireOptionalNativeModule<TerminalRuntimeNativeModule>("TerminalRuntime") ?? null) : null;

export function isTerminalRuntimeAvailable(): boolean { return TerminalRuntime !== null; }

export function subscribeToTerminalRuntime(callback: (event: TerminalStreamEvent) => void): () => void {
  if (!TerminalRuntime) return () => {};
  const subs = [
    TerminalRuntime.addListener("onSessionOutput", (e) => callback({ type: "output", sessionId: e.sessionId, data: e.data })),
    TerminalRuntime.addListener("onSessionExit", (e) => callback({ type: "exit", sessionId: e.sessionId, exitCode: e.exitCode })),
    TerminalRuntime.addListener("onSessionError", (e) => callback({ type: "error", sessionId: e.sessionId, message: e.message })),
    TerminalRuntime.addListener("onBootstrapProgress", (e) => callback({ type: "bootstrapProgress", percent: e.percent })),
  ];
  return () => { subs.forEach((s) => s.remove()); };
}

export async function execOnce(input: { cwd?: string; command: string; timeoutMs?: number; env?: Record<string, string> }): Promise<TerminalExecResult> {
  if (!TerminalRuntime) return { exitCode: -1, stdout: "", stderr: "Terminal runtime not available." };
  try { const r = await TerminalRuntime.execOnce(input); return { exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr }; }
  catch (e) { return { exitCode: -1, stdout: "", stderr: e instanceof Error ? e.message : String(e) }; }
}

export async function getBootstrapStatus(): Promise<TerminalBootstrapStatus> {
  if (!TerminalRuntime) return { ready: false, root: "", supported: false };
  try { return await TerminalRuntime.bootstrapStatus(); } catch { return { ready: false, root: "", supported: false }; }
}

export async function installBootstrap(): Promise<{ ok: boolean; root?: string; message?: string; error?: string }> {
  if (!TerminalRuntime) return { ok: false, error: "not available" };
  try { return await TerminalRuntime.installBootstrap(); } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
}

export async function createTerminalSession(input: { name?: string; cwd?: string; shell?: string; useBootstrap?: boolean }): Promise<TerminalSessionInfo | null> {
  if (!TerminalRuntime) return null;
  try { return await TerminalRuntime.createSession(input); } catch { return null; }
}

export async function sendTerminalInput(sessionId: string, data: string): Promise<{ ok: boolean; error?: string }> {
  if (!TerminalRuntime) return { ok: false, error: "not available" };
  try { return await TerminalRuntime.sendInput({ sessionId, data }); } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
}

export async function closeTerminalSession(sessionId: string): Promise<{ ok: boolean }> {
  if (!TerminalRuntime) return { ok: false };
  try { return await TerminalRuntime.closeSession({ sessionId }); } catch { return { ok: false }; }
}

export async function listTerminalSessions(): Promise<Array<{ id: string; name: string; cwd: string; alive: boolean }>> {
  if (!TerminalRuntime) return [];
  try { return await TerminalRuntime.listSessions(); } catch { return []; }
}

export async function installTerminalPackage(input: { pkg: string; cwd?: string }): Promise<TerminalExecResult> {
  if (!TerminalRuntime) return { exitCode: -1, stdout: "", stderr: "not available" };
  try { const r = await TerminalRuntime.installPackage({ package: input.pkg, cwd: input.cwd }); return { exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr }; }
  catch (e) { return { exitCode: -1, stdout: "", stderr: e instanceof Error ? e.message : String(e) }; }
}

export { TerminalRuntime };
