import * as Crypto from "expo-crypto";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { projects } from "@/core/db/schema";
import { nowIso } from "@/core/db/repositories/shared";
import type { Project, ReasoningEffort } from "@/core/types/app-state";
import type { AppDatabase, ProjectRepository } from "@/core/db/repositories/types";

function factory(row: typeof projects.$inferSelect): Project {
  return { id: row.id, parentId: row.parentId, name: row.name, description: row.description, folderUri: row.folderUri, folderDisplayName: row.folderDisplayName, inheritFromParent: row.inheritFromParent, providerId: row.providerId, modelId: row.modelId, agentId: row.agentId, reasoningEffort: row.reasoningEffort as ReasoningEffort, autoApprove: row.autoApprove, color: row.color, icon: row.icon, sortOrder: row.sortOrder, createdAt: row.createdAt, updatedAt: row.updatedAt, archivedAt: row.archivedAt };
}

export function createProjectRepository(db: AppDatabase): ProjectRepository {
  return {
    async create(input) { const id = input.id ?? Crypto.randomUUID(); const ts = nowIso(); await db.insert(projects).values({ id, parentId: input.parentId ?? null, name: input.name, description: input.description ?? null, folderUri: input.folderUri ?? null, folderDisplayName: input.folderDisplayName ?? null, inheritFromParent: input.inheritFromParent ?? true, providerId: input.providerId ?? null, modelId: input.modelId ?? null, agentId: input.agentId ?? null, reasoningEffort: input.reasoningEffort ?? "medium", autoApprove: input.autoApprove ?? false, color: input.color ?? null, icon: input.icon ?? null, sortOrder: input.sortOrder ?? 0, createdAt: ts, updatedAt: ts, archivedAt: null }); const row = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0]; if (!row) throw new Error("Failed to create project"); return factory(row); },
    async getById(id) { const row = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0] ?? null; return row ? factory(row) : null; },
    async list() { const rows = await db.select().from(projects).where(isNull(projects.archivedAt)).orderBy(asc(projects.sortOrder), asc(projects.name)); return rows.map(factory); },
    async listByParent(parentId) { const rows = await db.select().from(projects).where(parentId === null ? and(isNull(projects.parentId), isNull(projects.archivedAt)) : and(eq(projects.parentId, parentId), isNull(projects.archivedAt))).orderBy(asc(projects.sortOrder), asc(projects.name)); return rows.map(factory); },
    async update(id, input) { const current = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0]; if (!current) return; await db.update(projects).set({ parentId: input.parentId !== undefined ? input.parentId : current.parentId, name: input.name ?? current.name, description: input.description !== undefined ? input.description : current.description, folderUri: input.folderUri !== undefined ? input.folderUri : current.folderUri, folderDisplayName: input.folderDisplayName !== undefined ? input.folderDisplayName : current.folderDisplayName, inheritFromParent: input.inheritFromParent !== undefined ? input.inheritFromParent : current.inheritFromParent, providerId: input.providerId !== undefined ? input.providerId : current.providerId, modelId: input.modelId !== undefined ? input.modelId : current.modelId, agentId: input.agentId !== undefined ? input.agentId : current.agentId, reasoningEffort: input.reasoningEffort ?? (current.reasoningEffort as ReasoningEffort), autoApprove: input.autoApprove !== undefined ? input.autoApprove : current.autoApprove, color: input.color !== undefined ? input.color : current.color, icon: input.icon !== undefined ? input.icon : current.icon, sortOrder: input.sortOrder ?? current.sortOrder, updatedAt: nowIso() }).where(eq(projects.id, id)); },
    async delete(id) { await db.delete(projects).where(eq(projects.id, id)); },
    async archive(id) { await db.update(projects).set({ archivedAt: nowIso(), updatedAt: nowIso() }).where(eq(projects.id, id)); },
  };
}
