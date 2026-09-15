import * as Crypto from "expo-crypto";
import { asc, desc, eq } from "drizzle-orm";
import { parallelRunWorkers, parallelRuns } from "@/core/db/schema";
import { nowIso } from "@/core/db/repositories/shared";
import type { ParallelRun, ParallelRunPlanItem, ParallelRunStatus, ParallelRunWorker, ParallelRunWorkerStatus } from "@/core/types/app-state";
import type { AppDatabase, ParallelRunRepository } from "@/core/db/repositories/types";

function factoryRun(row: typeof parallelRuns.$inferSelect): ParallelRun {
  return { id: row.id, parentConversationId: row.parentConversationId, parentMessageId: row.parentMessageId, orchestratorAgentId: row.orchestratorAgentId, title: row.title, task: row.task, status: row.status as ParallelRunStatus, plan: (row.plan ?? []) as ParallelRunPlanItem[], summary: row.summary, projectId: row.projectId, startedAt: row.startedAt, updatedAt: row.updatedAt, completedAt: row.completedAt, lastError: row.lastError };
}
function factoryWorker(row: typeof parallelRunWorkers.$inferSelect): ParallelRunWorker {
  return { id: row.id, parallelRunId: row.parallelRunId, planItemId: row.planItemId, workerAgentId: row.workerAgentId, workerAgentName: row.workerAgentName, subtask: row.subtask, conversationId: row.conversationId, agentRunId: row.agentRunId, status: row.status as ParallelRunWorkerStatus, result: row.result, errorMessage: row.errorMessage, startedAt: row.startedAt, completedAt: row.completedAt, createdAt: row.createdAt, updatedAt: row.updatedAt };
}

export function createParallelRunRepository(db: AppDatabase): ParallelRunRepository {
  return {
    async create(input) { const id = input.id ?? Crypto.randomUUID(); const ts = nowIso(); await db.insert(parallelRuns).values({ id, parentConversationId: input.parentConversationId, parentMessageId: input.parentMessageId, orchestratorAgentId: input.orchestratorAgentId ?? null, title: input.title, task: input.task, status: input.status ?? "planning", plan: input.plan ?? [], summary: null, projectId: input.projectId ?? null, startedAt: input.startedAt ?? ts, updatedAt: ts, completedAt: null, lastError: null }); const row = (await db.select().from(parallelRuns).where(eq(parallelRuns.id, id)).limit(1))[0]; if (!row) throw new Error("Failed"); return factoryRun(row); },
    async getById(id) { const row = (await db.select().from(parallelRuns).where(eq(parallelRuns.id, id)).limit(1))[0] ?? null; return row ? factoryRun(row) : null; },
    async listByConversation(cid) { const rows = await db.select().from(parallelRuns).where(eq(parallelRuns.parentConversationId, cid)).orderBy(desc(parallelRuns.updatedAt)); return rows.map(factoryRun); },
    async list() { const rows = await db.select().from(parallelRuns).orderBy(desc(parallelRuns.updatedAt)); return rows.map(factoryRun); },
    async update(id, input) { const c = (await db.select().from(parallelRuns).where(eq(parallelRuns.id, id)).limit(1))[0]; if (!c) return; await db.update(parallelRuns).set({ status: input.status ?? c.status, plan: input.plan ?? c.plan, summary: input.summary !== undefined ? input.summary : c.summary, completedAt: input.completedAt !== undefined ? input.completedAt : c.completedAt, lastError: input.lastError !== undefined ? input.lastError : c.lastError, updatedAt: nowIso() }).where(eq(parallelRuns.id, id)); },
    async createWorker(input) { const id = Crypto.randomUUID(); const ts = nowIso(); await db.insert(parallelRunWorkers).values({ id, parallelRunId: input.parallelRunId, planItemId: input.planItemId, workerAgentId: input.workerAgentId, workerAgentName: input.workerAgentName, subtask: input.subtask, conversationId: input.conversationId ?? null, agentRunId: input.agentRunId ?? null, status: input.status ?? "pending", result: null, errorMessage: null, startedAt: input.startedAt ?? null, completedAt: null, createdAt: ts, updatedAt: ts }); const row = (await db.select().from(parallelRunWorkers).where(eq(parallelRunWorkers.id, id)).limit(1))[0]; if (!row) throw new Error("Failed"); return factoryWorker(row); },
    async listWorkers(rid) { const rows = await db.select().from(parallelRunWorkers).where(eq(parallelRunWorkers.parallelRunId, rid)).orderBy(asc(parallelRunWorkers.createdAt)); return rows.map(factoryWorker); },
    async updateWorker(id, input) { const c = (await db.select().from(parallelRunWorkers).where(eq(parallelRunWorkers.id, id)).limit(1))[0]; if (!c) return; await db.update(parallelRunWorkers).set({ status: input.status ?? c.status, result: input.result !== undefined ? input.result : c.result, errorMessage: input.errorMessage !== undefined ? input.errorMessage : c.errorMessage, conversationId: input.conversationId !== undefined ? input.conversationId : c.conversationId, agentRunId: input.agentRunId !== undefined ? input.agentRunId : c.agentRunId, startedAt: input.startedAt !== undefined ? input.startedAt : c.startedAt, completedAt: input.completedAt !== undefined ? input.completedAt : c.completedAt, updatedAt: nowIso() }).where(eq(parallelRunWorkers.id, id)); },
  };
}
