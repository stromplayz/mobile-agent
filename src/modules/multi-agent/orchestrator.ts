import type { AgentConfig, ParallelRun, ParallelRunPlanItem, ParallelRunWorker, ParallelRunWorkerStatus } from "@/core/types/app-state";
import { buildOrchestratorMergePrompt, buildOrchestratorPlanPrompt, buildWorkerPrompt, inferWorkerRole, ORCHESTRATOR_SYSTEM_PROMPT, parseOrchestratorPlan } from "@/modules/multi-agent/templates";

export type OrchestratorRuntime = {
  runAgent(input: { agent: AgentConfig; systemPrompt?: string; userMessage: string; projectId: string | null; conversationId?: string }): Promise<{ assistantMessage: string; errorMessage: string | null }>;
  createWorker(input: { parallelRunId: string; planItem: ParallelRunPlanItem; subtask: string }): Promise<ParallelRunWorker>;
  updateWorker(workerId: string, patch: { status?: ParallelRunWorkerStatus; result?: string | null; errorMessage?: string | null; conversationId?: string | null; startedAt?: string | null; completedAt?: string | null }): Promise<void>;
  updateRun(runId: string, patch: { status?: ParallelRun["status"]; plan?: ParallelRunPlanItem[]; summary?: string | null; completedAt?: string | null; lastError?: string | null }): Promise<void>;
};

export type OrchestratorOptions = { maxConcurrency?: number; workerTimeoutMs?: number };

export async function runOrchestrator(input: {
  run: ParallelRun; task: string; orchestratorAgent: AgentConfig; availableWorkers: AgentConfig[]; runtime: OrchestratorRuntime; options?: OrchestratorOptions;
}): Promise<void> {
  const { run, task, orchestratorAgent, availableWorkers, runtime } = input;
  const maxConcurrency = input.options?.maxConcurrency ?? 4;
  const workerTimeoutMs = input.options?.workerTimeoutMs ?? 120_000;
  try {
    await runtime.updateRun(run.id, { status: "planning" });
    const workersWithRoles = availableWorkers.map((w) => ({ agentId: w.id, name: w.name, role: inferWorkerRole(w) }));
    const planResponse = await runtime.runAgent({ agent: orchestratorAgent, systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT, userMessage: buildOrchestratorPlanPrompt({ task, availableWorkers: workersWithRoles }), projectId: run.projectId });
    if (planResponse.errorMessage) { await runtime.updateRun(run.id, { status: "failed", lastError: `Plan failed: ${planResponse.errorMessage}`, completedAt: new Date().toISOString() }); return; }
    const plan = parseOrchestratorPlan(planResponse.assistantMessage, workersWithRoles);
    await runtime.updateRun(run.id, { status: "dispatching", plan: plan.items });
    await runtime.updateRun(run.id, { status: "running" });
    const workerRows: ParallelRunWorker[] = [];
    for (const item of plan.items) { const w = await runtime.createWorker({ parallelRunId: run.id, planItem: item, subtask: item.description || item.title }); workerRows.push(w); }
    const queue = [...workerRows];
    const inflight: Promise<void>[] = [];
    const workerResults = new Map<string, { result: string; error: string | null }>();
    const runOneWorker = async (worker: ParallelRunWorker) => {
      const startedAt = new Date().toISOString();
      await runtime.updateWorker(worker.id, { status: "running", startedAt });
      try {
        const workerAgent = availableWorkers.find((a) => a.id === worker.workerAgentId);
        if (!workerAgent) throw new Error(`Worker agent ${worker.workerAgentName} not found`);
        const runPromise = runtime.runAgent({ agent: workerAgent, systemPrompt: workerAgent.prompt ?? undefined, userMessage: buildWorkerPrompt({ subtask: worker.subtask, parentTask: task, workerRole: inferWorkerRole(workerAgent) }), projectId: run.projectId, conversationId: worker.conversationId ?? undefined });
        const timeoutPromise = new Promise<{ assistantMessage: string; errorMessage: string | null }>((resolve) => setTimeout(() => resolve({ assistantMessage: "", errorMessage: `Timed out after ${workerTimeoutMs}ms` }), workerTimeoutMs));
        const result = await Promise.race([runPromise, timeoutPromise]);
        if (result.errorMessage) { await runtime.updateWorker(worker.id, { status: "failed", errorMessage: result.errorMessage, completedAt: new Date().toISOString() }); workerResults.set(worker.id, { result: "", error: result.errorMessage }); }
        else { await runtime.updateWorker(worker.id, { status: "completed", result: result.assistantMessage, completedAt: new Date().toISOString() }); workerResults.set(worker.id, { result: result.assistantMessage, error: null }); }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await runtime.updateWorker(worker.id, { status: "failed", errorMessage: msg, completedAt: new Date().toISOString() });
        workerResults.set(worker.id, { result: "", error: msg });
      }
    };
    while (queue.length > 0 || inflight.length > 0) {
      while (inflight.length < maxConcurrency && queue.length > 0) {
        const w = queue.shift()!;
        const p = runOneWorker(w).finally(() => { const idx = inflight.indexOf(p); if (idx >= 0) inflight.splice(idx, 1); });
        inflight.push(p);
      }
      if (inflight.length > 0) await Promise.race(inflight);
    }
    await runtime.updateRun(run.id, { status: "merging" });
    const finalWorkers = workerRows.map((w) => {
      const r = workerResults.get(w.id) ?? { result: "", error: "no result" };
      const wa = availableWorkers.find((a) => a.id === w.workerAgentId) ?? availableWorkers[0]!;
      return { workerRole: inferWorkerRole(wa), workerName: w.workerAgentName, subtask: w.subtask, result: r.result, errorMessage: r.error };
    });
    const mergeResponse = await runtime.runAgent({ agent: orchestratorAgent, systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT, userMessage: buildOrchestratorMergePrompt({ task, workerResults: finalWorkers }), projectId: run.projectId });
    if (mergeResponse.errorMessage) { await runtime.updateRun(run.id, { status: "failed", lastError: `Merge failed: ${mergeResponse.errorMessage}`, completedAt: new Date().toISOString() }); return; }
    await runtime.updateRun(run.id, { status: "completed", summary: mergeResponse.assistantMessage, completedAt: new Date().toISOString() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await runtime.updateRun(run.id, { status: "failed", lastError: msg, completedAt: new Date().toISOString() });
  }
}
