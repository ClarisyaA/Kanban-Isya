import { asc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Workspace } from "@/components/workspace";
import { db } from "@/db";
import { boardColumn, project, task } from "@/db/schema";
import { auth } from "@/lib/auth";
import type { Column, Priority, Project, Task } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const userId = session.user.id;

  const [projects, columns, tasks] = await Promise.all([
    db
      .select({ id: project.id, name: project.name, color: project.color, position: project.position })
      .from(project)
      .where(eq(project.userId, userId))
      .orderBy(asc(project.position), asc(project.createdAt)),
    db
      .select({
        id: boardColumn.id,
        projectId: boardColumn.projectId,
        name: boardColumn.name,
        position: boardColumn.position,
      })
      .from(boardColumn)
      .innerJoin(project, eq(project.id, boardColumn.projectId))
      .where(eq(project.userId, userId))
      .orderBy(asc(boardColumn.position), asc(boardColumn.createdAt)),
    db
      .select({
        id: task.id,
        projectId: task.projectId,
        columnId: task.columnId,
        title: task.title,
        description: task.description,
        priority: task.priority,
        startDate: task.startDate,
        dueDate: task.dueDate,
        completedDate: task.completedDate,
        position: task.position,
      })
      .from(task)
      .innerJoin(project, eq(project.id, task.projectId))
      .where(eq(project.userId, userId))
      .orderBy(asc(task.position), asc(task.createdAt)),
  ]);

  return (
    <Workspace
      user={{ name: session.user.name, email: session.user.email }}
      initialProjects={projects as Project[]}
      initialColumns={columns as Column[]}
      initialTasks={tasks.map((t) => ({ ...t, priority: t.priority as Priority })) as Task[]}
    />
  );
}
