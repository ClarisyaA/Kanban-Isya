"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { format, parseISO } from "date-fns";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { columnForProject, type BoardGroup } from "@/lib/board";
import { type Column, type Project, type Task } from "@/lib/types";

type Items = Record<string, string[]>;

export type TaskMove = { id: string; columnId: string; position: number };

type Props = {
  groups: BoardGroup[];
  /** Every column of every project; used to place auto-created columns. */
  allColumns: Column[];
  tasks: Task[];
  projects: Project[];
  isAll: boolean;
  onOpenTask: (task: Task) => void;
  onAddTask: (group: BoardGroup) => void;
  onTasksMoved: (moves: TaskMove[], newColumns: Column[]) => void;
  onAddGroup: (name: string) => void;
  onRenameGroup: (group: BoardGroup, name: string) => void;
  onDeleteGroup: (group: BoardGroup) => void;
  onMoveGroup: (group: BoardGroup, direction: -1 | 1) => void;
};

export function KanbanBoard({
  groups,
  allColumns,
  tasks,
  projects,
  isAll,
  onOpenTask,
  onAddTask,
  onTasksMoved,
  onAddGroup,
  onRenameGroup,
  onDeleteGroup,
  onMoveGroup,
}: Props) {
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const baseItems = useMemo(() => {
    const items: Items = {};
    const colToGroup = new Map<string, string>();
    for (const g of groups) {
      items[g.key] = [];
      for (const c of g.columns) colToGroup.set(c.id, g.key);
    }
    const sorted = [...tasks].sort((a, b) => a.position - b.position);
    for (const t of sorted) {
      const key = colToGroup.get(t.columnId);
      if (key) items[key].push(t.id);
    }
    return items;
  }, [groups, tasks]);

  const [dragItems, setDragItems] = useState<Items | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const items = dragItems ?? baseItems;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findContainer = (source: Items, id: string) =>
    id in source ? id : Object.keys(source).find((k) => source[k].includes(id));

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
    setDragItems(baseItems);
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const activeKey = String(active.id);
    const overKey = String(over.id);
    setDragItems((prev) => {
      const cur = prev ?? baseItems;
      const from = findContainer(cur, activeKey);
      const to = findContainer(cur, overKey);
      if (!from || !to || from === to) return cur;
      const target = [...cur[to]];
      const overIndex = target.indexOf(overKey);
      target.splice(overIndex >= 0 ? overIndex : target.length, 0, activeKey);
      return { ...cur, [from]: cur[from].filter((x) => x !== activeKey), [to]: target };
    });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const cur = dragItems ?? baseItems;
    setActiveId(null);
    setDragItems(null);
    if (!over) return;

    const activeKey = String(active.id);
    const overKey = String(over.id);
    const container = findContainer(cur, activeKey);
    let final = cur;
    if (container && container === findContainer(cur, overKey)) {
      const oldIndex = cur[container].indexOf(activeKey);
      const newIndex = cur[container].indexOf(overKey);
      if (newIndex >= 0 && oldIndex !== newIndex) {
        final = { ...cur, [container]: arrayMove(cur[container], oldIndex, newIndex) };
      }
    }

    // Translate the visual order back into concrete (columnId, position) per task.
    const moves: TaskMove[] = [];
    const newColumns: Column[] = [];
    for (const group of groups) {
      final[group.key]?.forEach((taskId, index) => {
        const t = tasksById.get(taskId);
        if (!t) return;
        let column =
          columnForProject(group, t.projectId) ??
          newColumns.find((c) => c.projectId === t.projectId && c.name === group.name);
        if (!column) {
          // "All projects" view: dropped into a board this project doesn't have yet.
          const own = allColumns.filter((c) => c.projectId === t.projectId).map((c) => c.position);
          column = {
            id: crypto.randomUUID(),
            projectId: t.projectId,
            name: group.name,
            position: own.length ? Math.max(...own) + 1 : 0,
          };
          newColumns.push(column);
        }
        if (t.columnId !== column.id || t.position !== index) {
          moves.push({ id: t.id, columnId: column.id, position: index });
        }
      });
    }
    if (moves.length) onTasksMoved(moves, newColumns);
  }

  const activeTask = activeId ? tasksById.get(activeId) : undefined;

  return (
    <DndContext
      id="kanban-dnd"
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setDragItems(null);
      }}
    >
      <div className="scrollbar-thin flex h-full items-start gap-4 overflow-x-auto p-4 md:p-6">
        {groups.map((group, index) => (
          <BoardColumn
            key={group.key}
            group={group}
            taskIds={items[group.key] ?? []}
            tasksById={tasksById}
            projectsById={projectsById}
            isAll={isAll}
            isFirst={index === 0}
            isLast={index === groups.length - 1}
            onOpenTask={onOpenTask}
            onAddTask={() => onAddTask(group)}
            onRename={(name) => onRenameGroup(group, name)}
            onDelete={() => onDeleteGroup(group)}
            onMove={(dir) => onMoveGroup(group, dir)}
          />
        ))}
        <AddColumn onAdd={onAddGroup} />
      </div>

      <DragOverlay>
        {activeTask ? (
          <TaskCardView
            task={activeTask}
            project={projectsById.get(activeTask.projectId)}
            showProject={isAll}
            className="rotate-1 shadow-lg"
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function BoardColumn({
  group,
  taskIds,
  tasksById,
  projectsById,
  isAll,
  isFirst,
  isLast,
  onOpenTask,
  onAddTask,
  onRename,
  onDelete,
  onMove,
}: {
  group: BoardGroup;
  taskIds: string[];
  tasksById: Map<string, Task>;
  projectsById: Map<string, Project>;
  isAll: boolean;
  isFirst: boolean;
  isLast: boolean;
  onOpenTask: (task: Task) => void;
  onAddTask: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: group.key });
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  return (
    <section className="flex max-h-full w-72 shrink-0 flex-col rounded-lg bg-stone-100/80">
      <header className="flex items-center gap-1 px-3 pb-2 pt-3">
        {editing ? (
          <InlineInput
            initial={group.name}
            onSubmit={(name) => {
              setEditing(false);
              if (name !== group.name) onRename(name);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            <h3
              className="min-w-0 flex-1 cursor-text truncate text-sm font-semibold text-stone-700"
              onDoubleClick={() => setEditing(true)}
              title="Klik dua kali untuk rename"
            >
              {group.name}
            </h3>
            <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-600">
              {taskIds.length}
            </span>
            <button className="icon-btn" onClick={onAddTask} title="Tambah task">
              <Plus size={16} />
            </button>
            <div className="relative" ref={menuRef}>
              <button className="icon-btn" onClick={() => setMenuOpen((v) => !v)} title="Opsi board">
                <MoreHorizontal size={16} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-8 z-20 w-48 rounded-lg border border-stone-200 bg-surface py-1 text-sm shadow-lg">
                  <MenuItem
                    icon={<Pencil size={14} />}
                    onClick={() => {
                      setMenuOpen(false);
                      setEditing(true);
                    }}
                  >
                    Rename board
                  </MenuItem>
                  {!isAll && !isFirst && (
                    <MenuItem
                      icon={<ArrowLeft size={14} />}
                      onClick={() => {
                        setMenuOpen(false);
                        onMove(-1);
                      }}
                    >
                      Geser ke kiri
                    </MenuItem>
                  )}
                  {!isAll && !isLast && (
                    <MenuItem
                      icon={<ArrowRight size={14} />}
                      onClick={() => {
                        setMenuOpen(false);
                        onMove(1);
                      }}
                    >
                      Geser ke kanan
                    </MenuItem>
                  )}
                  <MenuItem
                    danger
                    icon={<Trash2 size={14} />}
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete();
                    }}
                  >
                    Hapus board
                  </MenuItem>
                </div>
              )}
            </div>
          </>
        )}
      </header>

      <SortableContext id={group.key} items={taskIds} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={clsx(
            "scrollbar-thin flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 transition-colors",
            isOver && "rounded-md bg-stone-200/60",
          )}
        >
          {taskIds.map((id) => {
            const t = tasksById.get(id);
            if (!t) return null;
            return (
              <SortableTaskCard
                key={id}
                task={t}
                project={projectsById.get(t.projectId)}
                showProject={isAll}
                onOpen={() => onOpenTask(t)}
              />
            );
          })}
          {taskIds.length === 0 && (
            <p className="py-6 text-center text-xs text-stone-400">Belum ada task</p>
          )}
        </div>
      </SortableContext>

      <button
        onClick={onAddTask}
        className="m-2 mt-0 flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-stone-500 transition hover:bg-stone-200/70 hover:text-stone-800"
      >
        <Plus size={15} /> Tambah task
      </button>
    </section>
  );
}

function SortableTaskCard({
  task,
  project,
  showProject,
  onOpen,
}: {
  task: Task;
  project?: Project;
  showProject: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className={clsx(isDragging && "opacity-40")}
    >
      <TaskCardView task={task} project={project} showProject={showProject} />
    </div>
  );
}

function TaskCardView({
  task,
  project,
  showProject,
  className,
}: {
  task: Task;
  project?: Project;
  showProject: boolean;
  className?: string;
}) {
  const range = formatRange(task.startDate, task.dueDate);
  return (
    <article
      className={clsx(
        "cursor-grab rounded-md border border-stone-200 bg-surface px-3 py-2.5 transition hover:border-stone-400 active:cursor-grabbing",
        className,
      )}
    >
      <p className="text-sm leading-snug text-stone-900">{task.title}</p>
      {task.description && (
        <p className="mt-1 line-clamp-2 text-xs text-stone-500">{task.description}</p>
      )}
      {((showProject && project) || range || task.priority === "high") && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
          {showProject && project && (
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: project.color }} />
              <span className="truncate">{project.name}</span>
            </span>
          )}
          {range && <span>{range}</span>}
          {task.priority === "high" && <span className="font-medium text-red-700 dark:text-red-400">High</span>}
        </div>
      )}
    </article>
  );
}

function formatRange(start: string | null, due: string | null) {
  const f = (d: string) => format(parseISO(d), "d MMM");
  if (start && due) return start === due ? f(due) : `${f(start)} – ${f(due)}`;
  if (due) return `s/d ${f(due)}`;
  if (start) return `mulai ${f(start)}`;
  return null;
}

function AddColumn({ onAdd }: { onAdd: (name: string) => void }) {
  const [adding, setAdding] = useState(false);
  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="flex w-72 shrink-0 items-center gap-2 rounded-lg border border-dashed border-stone-300 px-4 py-3 text-sm font-medium text-stone-500 transition hover:border-stone-300 hover:bg-stone-100 hover:text-stone-700"
      >
        <Plus size={16} /> Tambah board
      </button>
    );
  }
  return (
    <div className="w-72 shrink-0 rounded-lg bg-stone-100 p-3">
      <InlineInput
        initial=""
        placeholder="Nama board, mis. Review"
        onSubmit={(name) => {
          onAdd(name);
          setAdding(false);
        }}
        onCancel={() => setAdding(false)}
      />
    </div>
  );
}

function InlineInput({
  initial,
  placeholder,
  onSubmit,
  onCancel,
}: {
  initial: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const submit = () => {
    const v = value.trim();
    if (v) onSubmit(v);
    else onCancel();
  };
  return (
    <form
      className="flex flex-1 items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        autoFocus
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
        className="input py-1"
      />
      <button type="submit" className="icon-btn" title="Simpan">
        <Check size={16} />
      </button>
      <button type="button" className="icon-btn" onClick={onCancel} title="Batal">
        <X size={16} />
      </button>
    </form>
  );
}

function MenuItem({
  icon,
  children,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-stone-50",
        danger ? "text-red-600 dark:text-red-400" : "text-stone-700",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
