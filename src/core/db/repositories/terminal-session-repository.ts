import * as Crypto from "expo-crypto";
import { asc, desc, eq } from "drizzle-orm";
import { terminalSessionOutput, terminalSessions } from "@/core/db/schema";
import { nowIso } from "@/core/db/repositories/shared";
import type { TerminalSession, TerminalSessionOutputEntry, TerminalSessionStatus, TerminalStreamKind } from "@/core/types/app-state";
import type { AppDatabase, TerminalSessionRepository } from "@/core/db/repositories/types";

function factory(row: typeof terminalSessions.$inferSelect): TerminalSession {
  return { id: row.id, name: row.name, projectId: row.projectId, cwd: row.cwd, shell: row.shell, status: row.status as TerminalSessionStatus, lastCommand: row.lastCommand, exitCode: row.exitCode, bootstrapReady: row.bootstrapReady, createdAt: row.createdAt, updatedAt: row.updatedAt, closedAt: row.closedAt };
}

export function createTerminalSessionRepository(db: AppDatabase): TerminalSessionRepository {
  return {
    async create(input) { const id = input.id ?? Crypto.randomUUID(); const ts = nowIso(); await db.insert(terminalSessions).values({ id, name: input.name, projectId: input.projectId ?? null, cwd: input.cwd, shell: input.shell, status: input.status ?? "idle", lastCommand: null, exitCode: null, bootstrapReady: input.bootstrapReady ?? false, createdAt: ts, updatedAt: ts, closedAt: null }); const row = (await db.select().from(terminalSessions).where(eq(terminalSessions.id, id)).limit(1))[0]; if (!row) throw new Error("Failed"); return factory(row); },
    async getById(id) { const row = (await db.select().from(terminalSessions).where(eq(terminalSessions.id, id)).limit(1))[0] ?? null; return row ? factory(row) : null; },
    async list() { const rows = await db.select().from(terminalSessions).orderBy(desc(terminalSessions.updatedAt)); return rows.map(factory); },
    async listByProject(pid) { const rows = await db.select().from(terminalSessions).where(eq(terminalSessions.projectId, pid)).orderBy(desc(terminalSessions.updatedAt)); return rows.map(factory); },
    async update(id, input) { const c = (await db.select().from(terminalSessions).where(eq(terminalSessions.id, id)).limit(1))[0]; if (!c) return; await db.update(terminalSessions).set({ status: input.status ?? c.status, lastCommand: input.lastCommand !== undefined ? input.lastCommand : c.lastCommand, exitCode: input.exitCode !== undefined ? input.exitCode : c.exitCode, bootstrapReady: input.bootstrapReady !== undefined ? input.bootstrapReady : c.bootstrapReady, closedAt: input.closedAt !== undefined ? input.closedAt : c.closedAt, updatedAt: nowIso() }).where(eq(terminalSessions.id, id)); },
    async delete(id) { await db.delete(terminalSessions).where(eq(terminalSessions.id, id)); },
    async appendOutput(input) { const id = Crypto.randomUUID(); const ts = nowIso(); await db.insert(terminalSessionOutput).values({ id, sessionId: input.sessionId, sequence: input.sequence, stream: input.stream as TerminalStreamKind, data: input.data, createdAt: ts }); const row = (await db.select().from(terminalSessionOutput).where(eq(terminalSessionOutput.id, id)).limit(1))[0]; if (!row) throw new Error("Failed"); return { id: row.id, sessionId: row.sessionId, sequence: row.sequence, stream: row.stream as TerminalStreamKind, data: row.data, createdAt: row.createdAt }; },
    async listOutput(sid, after = 0) { const rows = await db.select().from(terminalSessionOutput).where(eq(terminalSessionOutput.sessionId, sid)).orderBy(asc(terminalSessionOutput.sequence)); return rows.filter((r) => r.sequence > after).map((r) => ({ id: r.id, sessionId: r.sessionId, sequence: r.sequence, stream: r.stream as TerminalStreamKind, data: r.data, createdAt: r.createdAt })); },
    async getNextSequence(sid) { const rows = await db.select().from(terminalSessionOutput).where(eq(terminalSessionOutput.sessionId, sid)); return rows.reduce((a, r) => r.sequence > a ? r.sequence : a, 0) + 1; },
  };
}
