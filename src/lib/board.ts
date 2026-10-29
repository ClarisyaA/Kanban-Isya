import type { Column, Project } from "./types";

/**
 * A board column as displayed. In a single-project view each group wraps exactly one column.
 * In the "all projects" view, columns with the same name across projects are merged into one
 * group (e.g. every project's "To Do" shows up as a single "To Do" board).
 */
export type BoardGroup = {
  key: string;
  name: string;
  columns: Column[];
};

export const normalizeName = (name: string) => name.trim().toLowerCase();

export function buildGroups(
  columns: Column[],
  projects: Project[],
  projectId: string | null,
): BoardGroup[] {
  if (projectId) {
    return columns
      .filter((c) => c.projectId === projectId)
      .sort((a, b) => a.position - b.position)
      .map((c) => ({ key: c.id, name: c.name, columns: [c] }));
  }

  const projectOrder = new Map(projects.map((p, i) => [p.id, i]));
  const sorted = columns
    .filter((c) => projectOrder.has(c.projectId))
    .sort(
      (a, b) =>
        a.position - b.position ||
        (projectOrder.get(a.projectId) ?? 0) - (projectOrder.get(b.projectId) ?? 0),
    );

  const groups = new Map<string, BoardGroup>();
  for (const col of sorted) {
    const key = `name:${normalizeName(col.name)}`;
    const group = groups.get(key);
    if (group) group.columns.push(col);
    else groups.set(key, { key, name: col.name, columns: [col] });
  }
  return [...groups.values()];
}

/** Find the column a task of `projectId` should live in for a given group. */
export function columnForProject(group: BoardGroup, projectId: string) {
  return group.columns.find((c) => c.projectId === projectId);
}

export function isDoneColumn(name: string) {
  return /^(done|selesai|complete(d)?|finished)$/i.test(name.trim());
}
