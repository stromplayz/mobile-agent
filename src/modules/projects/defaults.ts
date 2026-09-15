import type { Project, ProjectTreeNode } from "@/core/types/app-state";

export const PROJECT_COLORS = ["#5996FF", "#A855F7", "#10B981", "#F59E0B", "#EF4444", "#06B6D4", "#EC4899", "#84CC16"];

export function pickProjectColor(siblingsCount: number): string {
  return PROJECT_COLORS[siblingsCount % PROJECT_COLORS.length] ?? PROJECT_COLORS[0]!;
}

export function flattenTree(nodes: ProjectTreeNode[]): Array<Project & { depth: number }> {
  const out: Array<Project & { depth: number }> = [];
  for (const n of nodes) {
    const { children, ...rest } = n;
    out.push(rest);
    if (children.length > 0) out.push(...flattenTree(children));
  }
  return out;
}

export function depthLabel(depth: number): string {
  if (depth === 0) return "Top-level project";
  if (depth === 1) return "Sub-project";
  if (depth === 2) return "Feature project";
  return `Level ${depth + 1} project`;
}
