import type { AgentConfig, ParallelRunPlanItem } from "@/core/types/app-state";

export const DEFAULT_WORKER_TEMPLATES: Array<{
  name: string;
  description: string;
  prompt: string;
  suggestedRole: "researcher" | "coder" | "reviewer" | "tester" | "writer";
}> = [
  { name: "researcher", description: "Gathers facts, reads files, runs web search, produces a structured brief.", suggestedRole: "researcher", prompt: "You are the Researcher worker. Gather information relevant to your subtask. End with ## Findings." },
  { name: "coder", description: "Implements the assigned subtask: writes code, edits files, runs commands.", suggestedRole: "coder", prompt: "You are the Coder worker. Implement the subtask end-to-end. End with ## Changes listing files touched." },
  { name: "reviewer", description: "Reviews the work of the other workers. Read-only; produces a critique.", suggestedRole: "reviewer", prompt: "You are the Reviewer worker. Review files and outputs. End with ## Review and APPROVE/NEEDS CHANGES." },
  { name: "tester", description: "Writes and runs tests for the assigned subtask; reports pass/fail.", suggestedRole: "tester", prompt: "You are the Tester worker. Write tests and run them. End with ## Test Results." },
  { name: "writer", description: "Produces documentation, READMEs, or commit messages for the subtask.", suggestedRole: "writer", prompt: "You are the Writer worker. Produce documentation. End with ## Docs." },
];

export const ORCHESTRATOR_SYSTEM_PROMPT = [
  "You are the ORCHESTRATOR in a multi-agent parallel run.",
  "PHASE 1 - PLAN: Decompose the task into 2-4 independent subtasks.",
  "Return ONLY JSON: {\"title\":\"<title>\",\"items\":[{\"id\":\"<id>\",\"title\":\"<title>\",\"description\":\"<desc>\",\"workerRole\":\"researcher|coder|reviewer|tester|writer\"}]}",
  "PHASE 2 - MERGE: After workers complete, produce a unified summary.",
].join("\n");

export function buildOrchestratorPlanPrompt(input: { task: string; availableWorkers: Array<{ agentId: string; name: string; role: string }> }): string {
  return [`User task: ${input.task}`, "", "Available worker roles:", ...input.availableWorkers.map((w) => `- ${w.role} (agent id=${w.agentId}, name=${w.name})`), "", "Decompose this task into 2-4 parallel subtasks and return the JSON plan."].join("\n");
}

export function buildWorkerPrompt(input: { subtask: string; parentTask: string; workerRole: string }): string {
  return [`You are the "${input.workerRole}" worker in a parallel agent run.`, "", "Overall parent task:", input.parentTask, "", "Your assigned subtask:", input.subtask, "", "Complete only your subtask."].join("\n");
}

export function buildOrchestratorMergePrompt(input: { task: string; workerResults: Array<{ workerRole: string; workerName: string; subtask: string; result: string; errorMessage: string | null }> }): string {
  const lines: string[] = ["All workers have completed. Produce the final merged summary.", "", `Original task: ${input.task}`, "", "Worker results:"];
  for (const w of input.workerResults) {
    lines.push(`### ${w.workerRole} (${w.workerName})`);
    if (w.errorMessage) lines.push(`[FAILED: ${w.errorMessage}]`);
    else lines.push(w.result);
    lines.push("");
  }
  return lines.join("\n");
}

export function parseOrchestratorPlan(response: string, availableWorkers: Array<{ agentId: string; name: string; role: string }>): { title: string; items: ParallelRunPlanItem[] } {
  const trimmed = response.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Orchestrator did not return JSON.");
  const parsed = JSON.parse(trimmed.slice(start, end + 1)) as { title?: string; items?: Array<{ id?: string; title?: string; description?: string; workerRole?: string }> };
  const items: ParallelRunPlanItem[] = (parsed.items ?? []).map((raw, idx) => {
    const role = raw.workerRole ?? "researcher";
    const worker = availableWorkers.find((w) => w.role === role) ?? availableWorkers[0];
    if (!worker) throw new Error(`No worker for role ${role}`);
    return { id: raw.id ?? `item-${idx + 1}`, title: raw.title ?? `Subtask ${idx + 1}`, description: raw.description ?? "", workerAgentId: worker.agentId, workerAgentName: worker.name };
  });
  if (items.length === 0) throw new Error("Empty plan");
  return { title: parsed.title ?? "Parallel run", items };
}

export function inferWorkerRole(agent: AgentConfig): string {
  const text = `${agent.name} ${agent.description ?? ""} ${agent.prompt ?? ""}`.toLowerCase();
  if (/research/.test(text)) return "researcher";
  if (/review|critique/.test(text)) return "reviewer";
  if (/test/.test(text)) return "tester";
  if (/writ|doc/.test(text)) return "writer";
  return "coder";
}
