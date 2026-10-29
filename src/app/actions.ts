"use server";

import { and, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { boardColumn, project, task } from "@/db/schema";
import { auth } from "@/lib/auth";
import { DEFAULT_COLUMNS, type Column, type Priority, type Project, type Task } from "@/lib/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PRIORITIES: Priority[] = ["low", "medium", "high"];

async function requireUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  return session.user.id;
}

function uuid(value: string) {
  if (!UUID_RE.test(value)) throw new Error("Invalid id");
  return value;
}

function name(value: string) {
  const trimmed = value.trim().slice(0, 120);
  if (!trimmed) throw new Error("Name is required");
  return trimmed;
}

function dateOrNull(value: string | null | undefined) {
  if (!value) return null;
  if (!DATE_RE.test(value)) throw new Error("Invalid date");
  return value;
}

async function ownedProjectIds(userId: string, projectIds: string[]) {
  if (projectIds.length === 0) return new Set<string>();
  const rows = await db
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.userId, userId), inArray(project.id, projectIds)));
  return new Set(rows.map((r) => r.id));
}

async function assertProject(userId: string, projectId: string) {
  const owned = await ownedProjectIds(userId, [uuid(projectId)]);
  if (!owned.has(projectId)) throw new Error("Project not found");
}

async function getOwnedColumn(userId: string, columnId: string) {
  const [col] = await db
    .select({ id: boardColumn.id, projectId: boardColumn.projectId })
    .from(boardColumn)
    .innerJoin(project, eq(project.id, boardColumn.projectId))
    .where(and(eq(boardColumn.id, uuid(columnId)), eq(project.userId, userId)));
  if (!col) throw new Error("Column not found");
  return col;
}

async function getOwnedTask(userId: string, taskId: string) {
  const [row] = await db
    .select({ id: task.id, projectId: task.projectId })
    .from(task)
    .innerJoin(project, eq(project.id, task.projectId))
    .where(and(eq(task.id, uuid(taskId)), eq(project.userId, userId)));
  if (!row) throw new Error("Task not found");
  return row;
}

/* ---------- Projects ---------- */

export async function createProject(input: {
  id: string;
  name: string;
  color: string;
  position: number;
}): Promise<{ project: Project; columns: Column[] }> {
  const userId = await requireUserId();
  const [created] = await db
    .insert(project)
    .values({
      id: uuid(input.id),
      userId,
      name: name(input.name),
      color: input.color.slice(0, 20),
      position: input.position,
    })
    .returning();
  const columns = await db
    .insert(boardColumn)
    .values(DEFAULT_COLUMNS.map((n, i) => ({ projectId: created.id, name: n, position: i })))
    .returning();
  return {
    project: { id: created.id, name: created.name, color: created.color, position: created.position },
    columns: columns.map((c) => ({ id: c.id, projectId: c.projectId, name: c.name, position: c.position })),
  };
}

export async function updateProject(id: string, patch: { name?: string; color?: string }) {
  const userId = await requireUserId();
  await assertProject(userId, id);
  await db
    .update(project)
    .set({
      ...(patch.name !== undefined && { name: name(patch.name) }),
      ...(patch.color !== undefined && { color: patch.color.slice(0, 20) }),
    })
    .where(eq(project.id, id));
}

export async function deleteProject(id: string) {
  const userId = await requireUserId();
  await assertProject(userId, id);
  await db.delete(project).where(eq(project.id, id));
}

/* ---------- Columns ---------- */

export async function createColumns(
  inputs: { id: string; projectId: string; name: string; position: number }[],
) {
  const userId = await requireUserId();
  if (inputs.length === 0) return;
  const owned = await ownedProjectIds(userId, [...new Set(inputs.map((i) => uuid(i.projectId)))]);
  if (inputs.some((i) => !owned.has(i.projectId))) throw new Error("Project not found");
  await db.insert(boardColumn).values(
    inputs.map((i) => ({
      id: uuid(i.id),
      projectId: i.projectId,
      name: name(i.name),
      position: i.position,
    })),
  );
}

export async function renameColumns(ids: string[], newName: string) {
  const userId = await requireUserId();
  for (const id of ids) await getOwnedColumn(userId, id);
  if (ids.length) await db.update(boardColumn).set({ name: name(newName) }).where(inArray(boardColumn.id, ids));
}

export async function deleteColumns(ids: string[]) {
  const userId = await requireUserId();
  for (const id of ids) await getOwnedColumn(userId, id);
  if (ids.length) await db.delete(boardColumn).where(inArray(boardColumn.id, ids));
}

export async function reorderColumns(projectId: string, orderedIds: string[]) {
  const userId = await requireUserId();
  await assertProject(userId, projectId);
  await db.transaction(async (tx) => {
    for (const [i, id] of orderedIds.entries()) {
      await tx
        .update(boardColumn)
        .set({ position: i })
        .where(and(eq(boardColumn.id, uuid(id)), eq(boardColumn.projectId, projectId)));
    }
  });
}

/* ---------- Tasks ---------- */

type TaskInput = Omit<Task, "position"> & { position: number };

export async function createTask(input: TaskInput) {
  const userId = await requireUserId();
  const col = await getOwnedColumn(userId, input.columnId);
  if (col.projectId !== input.projectId) throw new Error("Column does not belong to project");
  await db.insert(task).values({
    id: uuid(input.id),
    projectId: col.projectId,
    columnId: col.id,
    title: name(input.title),
    description: input.description.slice(0, 5000),
    priority: PRIORITIES.includes(input.priority) ? input.priority : "medium",
    startDate: dateOrNull(input.startDate),
    dueDate: dateOrNull(input.dueDate),
    completedDate: dateOrNull(input.completedDate),
    position: input.position,
  });
}

export async function updateTask(
  id: string,
  patch: Partial<Omit<Task, "id">>,
) {
  const userId = await requireUserId();
  const existing = await getOwnedTask(userId, id);

  let projectId = existing.projectId;
  if (patch.columnId !== undefined) {
    const col = await getOwnedColumn(userId, patch.columnId);
    projectId = col.projectId;
  } else if (patch.projectId !== undefined && patch.projectId !== existing.projectId) {
    throw new Error("Changing project requires a column");
  }

  await db
    .update(task)
    .set({
      projectId,
      ...(patch.columnId !== undefined && { columnId: patch.columnId }),
      ...(patch.title !== undefined && { title: name(patch.title) }),
      ...(patch.description !== undefined && { description: patch.description.slice(0, 5000) }),
      ...(patch.priority !== undefined &&
        PRIORITIES.includes(patch.priority) && { priority: patch.priority }),
      ...(patch.startDate !== undefined && { startDate: dateOrNull(patch.startDate) }),
      ...(patch.dueDate !== undefined && { dueDate: dateOrNull(patch.dueDate) }),
      ...(patch.completedDate !== undefined && { completedDate: dateOrNull(patch.completedDate) }),
      ...(patch.position !== undefined && { position: patch.position }),
    })
    .where(eq(task.id, id));
}

export async function deleteTask(id: string) {
  const userId = await requireUserId();
  await getOwnedTask(userId, id);
  await db.delete(task).where(eq(task.id, id));
}

/** Persist the result of a drag & drop: new column and position for each moved task. */
export async function moveTasks(
  moves: { id: string; columnId: string; position: number; completedDate: string | null }[],
) {
  const userId = await requireUserId();
  if (moves.length === 0) return;

  const columnIds = [...new Set(moves.map((m) => uuid(m.columnId)))];
  const cols = await db
    .select({ id: boardColumn.id, projectId: boardColumn.projectId })
    .from(boardColumn)
    .innerJoin(project, eq(project.id, boardColumn.projectId))
    .where(and(inArray(boardColumn.id, columnIds), eq(project.userId, userId)));
  const colProject = new Map(cols.map((c) => [c.id, c.projectId]));

  const taskIds = moves.map((m) => uuid(m.id));
  const tasks = await db
    .select({ id: task.id, projectId: task.projectId })
    .from(task)
    .innerJoin(project, eq(project.id, task.projectId))
    .where(and(inArray(task.id, taskIds), eq(project.userId, userId)));
  const taskProject = new Map(tasks.map((t) => [t.id, t.projectId]));

  for (const m of moves) {
    const tp = taskProject.get(m.id);
    if (!tp || colProject.get(m.columnId) !== tp) throw new Error("Invalid move");
  }

  await db.transaction(async (tx) => {
    for (const m of moves) {
      await tx
        .update(task)
        .set({ columnId: m.columnId, position: m.position, completedDate: dateOrNull(m.completedDate) })
        .where(eq(task.id, m.id));
    }
  });
}
