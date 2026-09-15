import type {
  ExternalFolderSession,
  Project,
  ProjectResolvedConfig,
  ProjectTreeNode,
  ReasoningEffort,
} from "@/core/types/app-state";

export function buildProjectTree(projects: Project[]): ProjectTreeNode[] {
  const byParent = new Map<string | null, Project[]>();
  for (const p of projects) {
    const key = p.parentId ?? null;
    const arr = byParent.get(key) ?? [];
    arr.push(p);
    byParent.set(key, arr);
  }
  for (const arr of byParent.values()) {
    arr.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }
  function expand(parentId: string | null, depth: number, visited: Set<string>): ProjectTreeNode[] {
    const list = byParent.get(parentId) ?? [];
    const nodes: ProjectTreeNode[] = [];
    for (const p of list) {
      if (visited.has(p.id)) continue;
      visited.add(p.id);
      const children = expand(p.id, depth + 1, visited);
      nodes.push({ ...p, children, depth });
    }
    return nodes;
  }
  return expand(null, 0, new Set());
}

export function resolveProjectConfig(
  allProjects: Project[],
  project: Project | null,
  defaults: { reasoningEffort: ReasoningEffort; autoApprove: boolean },
): ProjectResolvedConfig {
  if (!project) {
    return { providerId: null, modelId: null, agentId: null, reasoningEffort: defaults.reasoningEffort, autoApprove: defaults.autoApprove, externalFolderSession: null, source: "default" };
  }
  const byId = new Map(allProjects.map((p) => [p.id, p]));
  let providerId: string | null = project.providerId;
  let modelId: string | null = project.modelId;
  let agentId: string | null = project.agentId;
  let reasoningEffort: ReasoningEffort = project.reasoningEffort;
  let autoApprove: boolean = project.autoApprove;
  let externalFolderSession: ExternalFolderSession | null = project.folderUri
    ? { uri: project.folderUri, displayName: project.folderDisplayName ?? project.name, platform: "android", sourceType: "external-folder", grantedTo: project.createdAt } as any
    : null;
  // Fix: use grantedAt not grantedTo
  if (project.folderUri) {
    externalFolderSession = { uri: project.folderUri, displayName: project.folderDisplayName ?? project.name, platform: "android", sourceType: "external-folder", grantedAt: project.createdAt };
  }
  let source: "project" | "parent" | "default" = "project";
  let current: Project | null = project;
  const visited = new Set<string>([project.id]);
  while (current !== null && current.parentId && !visited.has(current.parentId)) {
    const parent: Project | null = byId.get(current.parentId) ?? null;
    if (!parent) break;
    visited.add(parent.id);
    if (current.inheritFromParent) {
      if (providerId === null && parent.providerId !== null) { providerId = parent.providerId; source = "parent"; }
      if (modelId === null && parent.modelId !== null) { modelId = parent.modelId; source = "parent"; }
      if (agentId === null && parent.agentId !== null) { agentId = parent.agentId; source = "parent"; }
      if (reasoningEffort === defaults.reasoningEffort && parent.reasoningEffort !== defaults.reasoningEffort) { reasoningEffort = parent.reasoningEffort; }
      if (autoApprove === false && parent.autoApprove === true) { autoApprove = true; }
      if (externalFolderSession === null && parent.folderUri) {
        externalFolderSession = { uri: parent.folderUri, displayName: parent.folderDisplayName ?? parent.name, platform: "android", sourceType: "external-folder", grantedAt: parent.createdAt };
        source = "parent";
      }
    }
    current = parent;
  }
  return { providerId, modelId, agentId, reasoningEffort, autoApprove, externalFolderSession, source };
}

export function projectAncestorPath(allProjects: Project[], project: Project): Project[] {
  const byId = new Map(allProjects.map((p) => [p.id, p]));
  const path: Project[] = [project];
  const visited = new Set<string>([project.id]);
  let current: Project | null = project;
  while (current !== null && current.parentId && !visited.has(current.parentId)) {
    const parent: Project | null = byId.get(current.parentId) ?? null;
    if (!parent) break;
    visited.add(parent.id);
    path.unshift(parent);
    current = parent;
  }
  return path;
}
