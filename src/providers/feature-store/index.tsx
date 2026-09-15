import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createContext, useContext } from "react";
import { createRepositories } from "@/core/db/database";
import type { Repositories } from "@/core/db/repositories/types";
import { createExternalFolderService } from "@/core/services/external-folder/external-folder-service";
import { useChat } from "@/hooks/use-chat";
import { buildProjectTree, resolveProjectConfig } from "@/modules/projects/resolver";
import type { AgentConfig, ParallelRun, ParallelRunPlanItem, ParallelRunWorker, Project, ProjectResolvedConfig, ReasoningEffort, TerminalSession } from "@/core/types/app-state";

type FeatureStoreContextValue = {
  projects: Project[];
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => Promise<void>;
  createProject: (input: { parentId?: string | null; name: string; description?: string | null; folderUri?: string | null; folderDisplayName?: string | null; inheritFromParent?: boolean; providerId?: string | null; modelId?: string | null; agentId?: string | null; reasoningEffort?: ReasoningEffort; autoApprove?: boolean; color?: string | null; icon?: string | null; }) => Promise<Project>;
  updateProject: (id: string, input: Partial<{ name: string; description: string | null; folderUri: string | null; folderDisplayName: string | null; inheritFromParent: boolean; providerId: string | null; modelId: string | null; agentId: string | null; reasoningEffort: ReasoningEffort; autoApprove: boolean; color: string | null; icon: string | null; sortOrder: number; }>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  pickFolderForProject: (projectId: string) => Promise<void>;
  resolveProjectConfig: (project: Project | null) => ProjectResolvedConfig;
  projectTree: ReturnType<typeof buildProjectTree>;
  parallelRuns: ParallelRun[];
  parallelRunWorkers: ParallelRunWorker[];
  startParallelRun: (input: { task: string; workerAgentIds: string[]; projectId?: string | null }) => Promise<string | null>;
  terminalSessions: TerminalSession[];
  refreshTerminalSessions: () => Promise<void>;
  hydrating: boolean;
  refresh: () => Promise<void>;
};

const FeatureStoreContext = createContext<FeatureStoreContextValue | null>(null);

export function FeatureStoreProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const repositoriesRef = useRef<Repositories>(createRepositories(db));
  const externalFolderServiceRef = useRef(createExternalFolderService());
  const { createConversation, sendMessage, currentConversation } = useChat();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(null);
  const [parallelRuns, setParallelRuns] = useState<ParallelRun[]>([]);
  const [parallelRunWorkers, setParallelRunWorkers] = useState<ParallelRunWorker[]>([]);
  const [terminalSessions, setTerminalSessions] = useState<TerminalSession[]>([]);
  const [hydrating, setHydrating] = useState(true);
  const repos = repositoriesRef.current;

  const loadAll = useCallback(async () => {
    const [p, pr, ts] = await Promise.all([repos.projectRepository.list(), repos.parallelRunRepository.list(), repos.terminalSessionRepository.list()]);
    setProjects(p); setParallelRuns(pr); setTerminalSessions(ts);
    const workers = await Promise.all(pr.map((run) => repos.parallelRunRepository.listWorkers(run.id)));
    setParallelRunWorkers(workers.flat());
  }, [repos]);

  useEffect(() => {
    let cancelled = false;
    setHydrating(true);
    loadAll().catch((e) => console.error("[FeatureStore] hydrate failed:", e)).finally(() => { if (!cancelled) setHydrating(false); });
    return () => { cancelled = true; };
  }, [loadAll]);

  const createProject = useCallback(async (input: Parameters<FeatureStoreContextValue["createProject"]>[0]) => {
    const project = await repos.projectRepository.create(input);
    setProjects((prev) => [...prev, project]);
    return project;
  }, [repos]);

  const updateProject = useCallback(async (id: string, input: Parameters<FeatureStoreContextValue["updateProject"]>[1]) => {
    await repos.projectRepository.update(id, input);
    const updated = await repos.projectRepository.getById(id);
    if (updated) setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
  }, [repos]);

  const deleteProject = useCallback(async (id: string) => {
    await repos.projectRepository.delete(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (activeProjectId === id) setActiveProjectIdState(null);
  }, [repos, activeProjectId]);

  const pickFolderForProject = useCallback(async (projectId: string) => {
    const session = await externalFolderServiceRef.current.pickDirectory();
    await repos.projectRepository.update(projectId, { folderUri: session.uri, folderDisplayName: session.displayName });
    const updated = await repos.projectRepository.getById(projectId);
    if (updated) setProjects((prev) => prev.map((p) => (p.id === projectId ? updated : p)));
  }, [repos]);

  const setActiveProjectId = useCallback(async (id: string | null) => { setActiveProjectIdState(id); }, []);

  const resolveProjectConfigFn = useCallback((project: Project | null): ProjectResolvedConfig => {
    return resolveProjectConfig(projects, project, { reasoningEffort: "medium", autoApprove: false });
  }, [projects]);

  const projectTree = useMemo(() => buildProjectTree(projects), [projects]);

  const startParallelRun = useCallback(async (input: { task: string; workerAgentIds: string[]; projectId?: string | null }): Promise<string | null> => {
    if (!currentConversation) { console.warn("[FeatureStore] No active conversation"); return null; }
    const parentConversationId = currentConversation.id;
    const parentMessageId = `pending-${Date.now()}`;
    const workers: AgentConfig[] = (await repos.agentRepository.list()).filter((a) => input.workerAgentIds.includes(a.id));
    if (workers.length === 0) return null;
    const plan: ParallelRunPlanItem[] = workers.map((w, idx) => ({ id: `item-${idx + 1}`, title: `${w.name} contribution`, description: `Contribute from ${w.name}'s perspective: ${input.task}`, workerAgentId: w.id, workerAgentName: w.name }));
    const run = await repos.parallelRunRepository.create({ parentConversationId, parentMessageId, title: `Parallel: ${input.task.slice(0, 60)}`, task: input.task, status: "dispatching", plan, projectId: input.projectId ?? activeProjectId });
    const workerRows: ParallelRunWorker[] = [];
    for (const item of plan) { const w = await repos.parallelRunRepository.createWorker({ parallelRunId: run.id, planItemId: item.id, workerAgentId: item.workerAgentId, workerAgentName: item.workerAgentName, subtask: item.description, status: "pending" }); workerRows.push(w); }
    setParallelRuns((prev) => [run, ...prev]);
    setParallelRunWorkers((prev) => [...prev, ...workerRows]);
    (async () => {
      await repos.parallelRunRepository.update(run.id, { status: "running" });
      setParallelRuns((prev) => prev.map((r) => (r.id === run.id ? { ...r, status: "running" } : r)));
      await Promise.all(workerRows.map(async (worker) => {
        const startedAt = new Date().toISOString();
        await repos.parallelRunRepository.updateWorker(worker.id, { status: "running", startedAt });
        setParallelRunWorkers((prev) => prev.map((w) => (w.id === worker.id ? { ...w, status: "running", startedAt } : w)));
        try {
          await createConversation({ agentId: worker.workerAgentId });
          await sendMessage({ content: worker.subtask });
          const completedAt = new Date().toISOString();
          await repos.parallelRunRepository.updateWorker(worker.id, { status: "completed", completedAt });
          setParallelRunWorkers((prev) => prev.map((w) => (w.id === worker.id ? { ...w, status: "completed", completedAt } : w)));
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          const completedAt = new Date().toISOString();
          await repos.parallelRunRepository.updateWorker(worker.id, { status: "failed", errorMessage: msg, completedAt });
          setParallelRunWorkers((prev) => prev.map((w) => (w.id === worker.id ? { ...w, status: "failed", errorMessage: msg, completedAt } : w)));
        }
      }));
      const allOk = true;
      await repos.parallelRunRepository.update(run.id, { status: "completed", summary: `Workers completed.`, completedAt: new Date().toISOString() });
      setParallelRuns((prev) => prev.map((r) => (r.id === run.id ? { ...r, status: "completed", summary: "Workers completed.", completedAt: new Date().toISOString() } : r)));
    })().catch((e) => console.error("[FeatureStore] parallel run failed:", e));
    return run.id;
  }, [currentConversation, createConversation, sendMessage, activeProjectId, repos]);

  const refreshTerminalSessions = useCallback(async () => { const sessions = await repos.terminalSessionRepository.list(); setTerminalSessions(sessions); }, [repos]);
  const refresh = useCallback(async () => { await loadAll(); }, [loadAll]);

  const value: FeatureStoreContextValue = {
    projects, activeProjectId, setActiveProjectId, createProject, updateProject, deleteProject, pickFolderForProject,
    resolveProjectConfig: resolveProjectConfigFn, projectTree, parallelRuns, parallelRunWorkers, startParallelRun,
    terminalSessions, refreshTerminalSessions, hydrating, refresh,
  };
  return <FeatureStoreContext.Provider value={value}>{children}</FeatureStoreContext.Provider>;
}

export function useFeatureStore() {
  const ctx = useContext(FeatureStoreContext);
  if (!ctx) throw new Error("useFeatureStore must be used within FeatureStoreProvider");
  return ctx;
}
