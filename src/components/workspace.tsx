"use client";

import clsx from "clsx";
import { format } from "date-fns";
import {
  GanttChartSquare,
  KanbanSquare,
  Layers,
  LogOut,
  Pencil,
  Plus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createColumns,
  createProject,
  createTask,
  deleteColumns,
  deleteProject,
  deleteTask,
  moveTasks,
  renameColumns,
  reorderColumns,
  updateProject,
  updateTask,
} from "@/app/actions";
import { signOut } from "@/lib/auth-client";
import { buildGroups, columnForProject, normalizeName, type BoardGroup } from "@/lib/board";
import { ALL_PROJECTS, type Column, type Project, type Task } from "@/lib/types";
import { GanttChart } from "./gantt-chart";
import { KanbanBoard, type TaskMove } from "./kanban-board";
import { ProjectDialog } from "./project-dialog";
import { TaskDialog } from "./task-dialog";

type View = "board" | "timeline";
const STORAGE_KEY = "kanban:selected";

type Props = {
  user: { name: string; email: string };
  initialProjects: Project[];
  initialColumns: Column[];
  initialTasks: Task[];
};

export function Workspace({ user, initialProjects, initialColumns, initialTasks }: Props) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [columns, setColumns] = useState(initialColumns);
  const [tasks, setTasks] = useState(initialTasks);
  const [selected, setSelected] = useState<string>(ALL_PROJECTS);
  const [view, setView] = useState<View>("board");
  const [taskDialog, setTaskDialog] = useState<{ task: Task; isNew: boolean } | null>(null);
  const [projectDialog, setProjectDialog] = useState<{ project: Project | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Remember the last selected project / view per browser.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      if (saved.project && initialProjects.some((p) => p.id === saved.project)) setSelected(saved.project);
      if (saved.view === "board" || saved.view === "timeline") setView(saved.view);
    } catch {}
  }, [initialProjects]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ project: selected, view }));
    } catch {}
  }, [selected, view]);

  const persist = useCallback((work: () => Promise<unknown>) => {
    work().catch((e: unknown) => {
      console.error(e);
      setError(e instanceof Error ? e.message : "Gagal menyimpan perubahan");
    });
  }, []);

  const currentProject = projects.find((p) => p.id === selected) ?? null;
  const isAll = !currentProject;

  const visibleTasks = useMemo(
    () => (currentProject ? tasks.filter((t) => t.projectId === currentProject.id) : tasks),
    [tasks, currentProject],
  );
  const groups = useMemo(
    () => buildGroups(columns, projects, currentProject?.id ?? null),
    [columns, projects, currentProject],
  );
  const taskCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tasks) counts.set(t.projectId, (counts.get(t.projectId) ?? 0) + 1);
    return counts;
  }, [tasks]);

  /* ---------- Projects ---------- */

  async function saveProject(values: { name: string; color: string }) {
    const editing = projectDialog?.project;
    setProjectDialog(null);
    if (editing) {
      setProjects((ps) => ps.map((p) => (p.id === editing.id ? { ...p, ...values } : p)));
      persist(() => updateProject(editing.id, values));
      return;
    }
    try {
      const result = await createProject({
        id: crypto.randomUUID(),
        ...values,
        position: projects.length ? Math.max(...projects.map((p) => p.position)) + 1 : 0,
      });
      setProjects((ps) => [...ps, result.project]);
      setColumns((cs) => [...cs, ...result.columns]);
      setSelected(result.project.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat project");
    }
  }

  function removeProject(id: string) {
    setProjectDialog(null);
    setProjects((ps) => ps.filter((p) => p.id !== id));
    setColumns((cs) => cs.filter((c) => c.projectId !== id));
    setTasks((ts) => ts.filter((t) => t.projectId !== id));
    if (selected === id) setSelected(ALL_PROJECTS);
    persist(() => deleteProject(id));
  }

  /* ---------- Boards (columns) ---------- */

  function addGroup(name: string) {
    if (projects.length === 0) {
      setError("Buat project dulu sebelum menambah board.");
      return;
    }
    const targets = currentProject ? [currentProject] : projects;
    const created: Column[] = [];
    for (const p of targets) {
      const own = columns.filter((c) => c.projectId === p.id);
      if (!currentProject && own.some((c) => normalizeName(c.name) === normalizeName(name))) continue;
      created.push({
        id: crypto.randomUUID(),
        projectId: p.id,
        name,
        position: own.length ? Math.max(...own.map((c) => c.position)) + 1 : 0,
      });
    }
    if (created.length === 0) return;
    setColumns((cs) => [...cs, ...created]);
    persist(() => createColumns(created));
  }

  function renameGroup(group: BoardGroup, name: string) {
    const ids = new Set(group.columns.map((c) => c.id));
    setColumns((cs) => cs.map((c) => (ids.has(c.id) ? { ...c, name } : c)));
    persist(() => renameColumns([...ids], name));
  }

  function deleteGroup(group: BoardGroup) {
    const ids = new Set(group.columns.map((c) => c.id));
    const count = tasks.filter((t) => ids.has(t.columnId)).length;
    const scope = isAll && group.columns.length > 1 ? ` di ${group.columns.length} project` : "";
    const msg = count
      ? `Hapus board "${group.name}"${scope}? ${count} task di dalamnya juga akan terhapus.`
      : `Hapus board "${group.name}"${scope}?`;
    if (!confirm(msg)) return;
    setColumns((cs) => cs.filter((c) => !ids.has(c.id)));
    setTasks((ts) => ts.filter((t) => !ids.has(t.columnId)));
    persist(() => deleteColumns([...ids]));
  }

  function moveGroup(group: BoardGroup, direction: -1 | 1) {
    if (!currentProject) return;
    const ordered = groups.map((g) => g.columns[0]);
    const from = ordered.findIndex((c) => c.id === group.key);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= ordered.length) return;
    [ordered[from], ordered[to]] = [ordered[to], ordered[from]];
    const positions = new Map(ordered.map((c, i) => [c.id, i]));
    setColumns((cs) => cs.map((c) => (positions.has(c.id) ? { ...c, position: positions.get(c.id)! } : c)));
    persist(() => reorderColumns(currentProject.id, ordered.map((c) => c.id)));
  }

  /* ---------- Tasks ---------- */

  function blankTask(projectId: string, columnId: string, overrides: Partial<Task> = {}): Task {
    return {
      id: crypto.randomUUID(),
      projectId,
      columnId,
      title: "",
      description: "",
      priority: "medium",
      startDate: null,
      dueDate: null,
      position: 0,
      ...overrides,
    };
  }

  function firstColumnOf(projectId: string) {
    return columns
      .filter((c) => c.projectId === projectId)
      .sort((a, b) => a.position - b.position)[0];
  }

  function openNewTask(group?: BoardGroup) {
    const project = currentProject ?? projects[0];
    if (!project) {
      setProjectDialog({ project: null });
      return;
    }
    const column = (group && columnForProject(group, project.id)) ?? firstColumnOf(project.id);
    const today = format(new Date(), "yyyy-MM-dd");
    setTaskDialog({
      task: blankTask(
        project.id,
        column?.id ?? "",
        view === "timeline" ? { startDate: today, dueDate: today } : {},
      ),
      isNew: true,
    });
  }

  function saveTask(draft: Task) {
    const isNew = taskDialog?.isNew;
    setTaskDialog(null);
    const original = tasks.find((t) => t.id === draft.id);
    const columnChanged = !original || original.columnId !== draft.columnId;
    const position = columnChanged
      ? Math.max(-1, ...tasks.filter((t) => t.columnId === draft.columnId).map((t) => t.position)) + 1
      : draft.position;
    const next = { ...draft, position };

    if (isNew) {
      setTasks((ts) => [...ts, next]);
      persist(() => createTask(next));
    } else {
      setTasks((ts) => ts.map((t) => (t.id === next.id ? next : t)));
      const { id, ...patch } = next;
      persist(() => updateTask(id, patch));
    }
  }

  function removeTask(id: string) {
    setTaskDialog(null);
    setTasks((ts) => ts.filter((t) => t.id !== id));
    persist(() => deleteTask(id));
  }

  function tasksMoved(moves: TaskMove[], newColumns: Column[]) {
    const byId = new Map(moves.map((m) => [m.id, m]));
    if (newColumns.length) setColumns((cs) => [...cs, ...newColumns]);
    setTasks((ts) =>
      ts.map((t) => {
        const m = byId.get(t.id);
        return m ? { ...t, columnId: m.columnId, position: m.position } : t;
      }),
    );
    persist(async () => {
      if (newColumns.length) await createColumns(newColumns);
      await moveTasks(moves);
    });
  }

  function changeDates(taskId: string, startDate: string, dueDate: string) {
    setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, startDate, dueDate } : t)));
    persist(() => updateTask(taskId, { startDate, dueDate }));
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
    router.refresh();
  }

  /* ---------- Render ---------- */

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-2 px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <KanbanSquare size={18} />
          </div>
          <span className="font-semibold text-slate-900">Kanban Board</span>
        </div>

        <nav className="scrollbar-thin flex-1 overflow-y-auto px-2">
          <SidebarItem
            active={isAll}
            onClick={() => setSelected(ALL_PROJECTS)}
            icon={<Layers size={16} />}
            label="Semua Project"
            count={tasks.length}
          />
          <div className="mb-1 mt-4 flex items-center justify-between px-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Project</span>
            <button className="icon-btn" onClick={() => setProjectDialog({ project: null })} title="Project baru">
              <Plus size={16} />
            </button>
          </div>
          {projects.map((p) => (
            <SidebarItem
              key={p.id}
              active={selected === p.id}
              onClick={() => setSelected(p.id)}
              icon={<span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />}
              label={p.name}
              count={taskCount.get(p.id) ?? 0}
              onEdit={() => setProjectDialog({ project: p })}
            />
          ))}
          {projects.length === 0 && (
            <p className="px-2 py-2 text-xs text-slate-400">Belum ada project.</p>
          )}
        </nav>

        <div className="flex items-center gap-2 border-t border-slate-200 p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
            {user.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <button className="icon-btn" onClick={handleSignOut} title="Keluar">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 md:px-6">
          {/* Mobile project switcher */}
          <select
            className="input w-auto md:hidden"
            value={currentProject?.id ?? ALL_PROJECTS}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value={ALL_PROJECTS}>Semua Project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <div className="hidden min-w-0 items-center gap-2 md:flex">
            {currentProject && (
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: currentProject.color }} />
            )}
            <h1 className="truncate text-lg font-semibold text-slate-900">
              {currentProject?.name ?? "Semua Project"}
            </h1>
            {currentProject && (
              <button className="icon-btn" onClick={() => setProjectDialog({ project: currentProject })}>
                <Pencil size={14} />
              </button>
            )}
          </div>

          <div className="flex rounded-lg bg-slate-100 p-0.5 text-sm">
            <ViewTab active={view === "board"} onClick={() => setView("board")} icon={<KanbanSquare size={15} />}>
              Board
            </ViewTab>
            <ViewTab
              active={view === "timeline"}
              onClick={() => setView("timeline")}
              icon={<GanttChartSquare size={15} />}
            >
              Timeline
            </ViewTab>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button className="btn-ghost md:hidden" onClick={() => setProjectDialog({ project: null })}>
              + Project
            </button>
            <button className="btn-primary flex items-center gap-1" onClick={() => openNewTask()}>
              <Plus size={16} /> Task
            </button>
            <button className="icon-btn md:hidden" onClick={handleSignOut} title="Keluar">
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {error && (
          <div className="flex items-center gap-3 border-b border-red-200 bg-red-50 px-6 py-2 text-sm text-red-700">
            <span className="flex-1">{error}</span>
            <button className="font-medium underline" onClick={() => window.location.reload()}>
              Muat ulang
            </button>
            <button className="font-medium" onClick={() => setError(null)}>
              Tutup
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1">
          {projects.length === 0 ? (
            <EmptyState onCreate={() => setProjectDialog({ project: null })} />
          ) : view === "board" ? (
            <KanbanBoard
              groups={groups}
              allColumns={columns}
              tasks={visibleTasks}
              projects={projects}
              isAll={isAll}
              onOpenTask={(task) => setTaskDialog({ task, isNew: false })}
              onAddTask={openNewTask}
              onTasksMoved={tasksMoved}
              onAddGroup={addGroup}
              onRenameGroup={renameGroup}
              onDeleteGroup={deleteGroup}
              onMoveGroup={moveGroup}
            />
          ) : (
            <GanttChart
              tasks={visibleTasks}
              projects={projects}
              columns={columns}
              isAll={isAll}
              onOpenTask={(task) => setTaskDialog({ task, isNew: false })}
              onChangeDates={changeDates}
            />
          )}
        </div>
      </main>

      {taskDialog && (
        <TaskDialog
          task={taskDialog.task}
          isNew={taskDialog.isNew}
          projects={projects}
          columns={columns}
          onSave={saveTask}
          onDelete={removeTask}
          onClose={() => setTaskDialog(null)}
        />
      )}
      {projectDialog && (
        <ProjectDialog
          project={projectDialog.project}
          onSave={saveProject}
          onDelete={removeProject}
          onClose={() => setProjectDialog(null)}
        />
      )}
    </div>
  );
}

function SidebarItem({
  active,
  onClick,
  icon,
  label,
  count,
  onEdit,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
  onEdit?: () => void;
}) {
  return (
    <div
      className={clsx(
        "group mb-0.5 flex items-center rounded-lg pr-1 text-sm transition",
        active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100",
      )}
    >
      <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left">
        <span className="flex w-4 justify-center">{icon}</span>
        <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
        <span className="text-xs text-slate-400 group-hover:hidden">{count}</span>
      </button>
      {onEdit && (
        <button className="icon-btn hidden group-hover:inline-flex" onClick={onEdit} title="Edit project">
          <Pencil size={13} />
        </button>
      )}
    </div>
  );
}

function ViewTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition",
        active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
        <Layers size={24} />
      </div>
      <h2 className="text-lg font-semibold text-slate-900">Mulai dengan membuat project</h2>
      <p className="max-w-sm text-sm text-slate-500">
        Setiap project punya board dan timeline sendiri. Pilih &ldquo;Semua Project&rdquo; untuk melihat
        semuanya digabung.
      </p>
      <button className="btn-primary mt-2" onClick={onCreate}>
        <span className="flex items-center gap-1">
          <Plus size={16} /> Project baru
        </span>
      </button>
    </div>
  );
}
