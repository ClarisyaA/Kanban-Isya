"use client";

import clsx from "clsx";
import {
  addDays,
  differenceInCalendarDays,
  format,
  isWeekend,
  parseISO,
  startOfDay,
} from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Check, Crosshair } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { isDoneColumn } from "@/lib/board";
import type { Column, Project, Task } from "@/lib/types";

const LEFT_WIDTH = 260;
const ROW_HEIGHT = 40;
const ZOOMS = [
  { label: "Hari", dayWidth: 44 },
  { label: "Minggu", dayWidth: 20 },
  { label: "Bulan", dayWidth: 8 },
] as const;

type DragMode = "move" | "start" | "end";
type DragState = { id: string; mode: DragMode; originX: number; delta: number };

type Row =
  | { kind: "project"; project: Project; count: number }
  | { kind: "task"; task: Task };

type Props = {
  tasks: Task[];
  projects: Project[];
  columns: Column[];
  isAll: boolean;
  onOpenTask: (task: Task) => void;
  onChangeDates: (taskId: string, startDate: string, dueDate: string) => void;
};

const toISO = (d: Date) => format(d, "yyyy-MM-dd");

function taskSpan(task: Task) {
  const start = task.startDate ?? task.dueDate;
  const end = task.dueDate ?? task.startDate;
  if (!start || !end) return null;
  const s = parseISO(start);
  const e = parseISO(end);
  return e < s ? { start: e, end: s } : { start: s, end: e };
}

export function GanttChart({ tasks, projects, columns, isAll, onOpenTask, onChangeDates }: Props) {
  const [zoom, setZoom] = useState(0);
  const [drag, setDrag] = useState<DragState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dayWidth = ZOOMS[zoom].dayWidth;
  const today = startOfDay(new Date());

  const columnsById = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);

  // Visible date range: all task dates plus some breathing room around today.
  const { rangeStart, totalDays } = useMemo(() => {
    let min = addDays(today, -7);
    let max = addDays(today, 30);
    for (const t of tasks) {
      const span = taskSpan(t);
      if (!span) continue;
      if (span.start < min) min = span.start;
      if (span.end > max) max = span.end;
    }
    const start = addDays(min, -7);
    const end = addDays(max, 21);
    return { rangeStart: start, totalDays: differenceInCalendarDays(end, start) + 1 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, today.getTime()]);

  const days = useMemo(
    () => Array.from({ length: totalDays }, (_, i) => addDays(rangeStart, i)),
    [rangeStart, totalDays],
  );

  const months = useMemo(() => {
    const result: { label: string; days: number }[] = [];
    for (const d of days) {
      const label = format(d, "MMMM yyyy", { locale: localeId });
      const last = result[result.length - 1];
      if (last?.label === label) last.days++;
      else result.push({ label, days: 1 });
    }
    return result;
  }, [days]);

  const rows = useMemo<Row[]>(() => {
    const sortTasks = (list: Task[]) =>
      [...list].sort((a, b) => {
        const sa = taskSpan(a)?.start.getTime() ?? Infinity;
        const sb = taskSpan(b)?.start.getTime() ?? Infinity;
        return sa - sb || a.title.localeCompare(b.title);
      });
    if (!isAll) return sortTasks(tasks).map((task) => ({ kind: "task", task }));
    const result: Row[] = [];
    for (const project of projects) {
      const list = tasks.filter((t) => t.projectId === project.id);
      if (list.length === 0) continue;
      result.push({ kind: "project", project, count: list.length });
      for (const task of sortTasks(list)) result.push({ kind: "task", task });
    }
    return result;
  }, [tasks, projects, isAll]);

  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const timelineWidth = totalDays * dayWidth;
  const todayOffset = differenceInCalendarDays(today, rangeStart) * dayWidth;

  const scrollToToday = () => {
    scrollRef.current?.scrollTo({ left: Math.max(0, todayOffset - 240), behavior: "smooth" });
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ left: Math.max(0, todayOffset - 240) });
    // Only on mount / zoom change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  function startDrag(e: React.PointerEvent, task: Task, mode: DragMode) {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id: task.id, mode, originX: e.clientX, delta: 0 });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const delta = Math.round((e.clientX - drag.originX) / dayWidth);
    if (delta !== drag.delta) setDrag({ ...drag, delta });
  }

  function endDrag(e: React.PointerEvent, task: Task) {
    if (!drag || drag.id !== task.id) return;
    const moved = Math.abs(e.clientX - drag.originX) > 3;
    const span = taskSpan(task);
    setDrag(null);
    if (!moved) {
      onOpenTask(task);
      return;
    }
    if (!span || drag.delta === 0) return;
    const next = applyDrag(span, drag);
    onChangeDates(task.id, toISO(next.start), toISO(next.end));
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-stone-200 bg-surface px-4 py-2 md:px-6">
        <p className="hidden text-xs text-stone-500 sm:block">
          Drag bar untuk menggeser jadwal, tarik ujung bar untuk mengubah durasi, klik untuk detail.
        </p>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={scrollToToday} className="btn-ghost flex items-center gap-1 whitespace-nowrap">
            <Crosshair size={14} /> Hari ini
          </button>
          <div className="flex rounded-lg bg-stone-100 p-0.5 text-xs">
            {ZOOMS.map((z, i) => (
              <button
                key={z.label}
                onClick={() => setZoom(i)}
                className={clsx(
                  "rounded-md px-2.5 py-1 font-medium",
                  zoom === i ? "bg-surface text-stone-900" : "text-stone-500",
                )}
              >
                {z.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-stone-400">
          Belum ada task. Tambahkan task untuk melihat timeline.
        </div>
      ) : (
        <div ref={scrollRef} className="scrollbar-thin relative flex-1 overflow-auto bg-surface">
          <div style={{ width: LEFT_WIDTH + timelineWidth }} className="relative">
            {/* Header */}
            <div className="sticky top-0 z-20 flex border-b border-stone-200 bg-surface">
              <div
                className="sticky left-0 z-30 flex shrink-0 items-end border-r border-stone-200 bg-surface px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-stone-500"
                style={{ width: LEFT_WIDTH }}
              >
                Task
              </div>
              <div style={{ width: timelineWidth }}>
                <div className="flex border-b border-stone-100">
                  {months.map((m, i) => (
                    <div
                      key={i}
                      className="truncate border-r border-stone-100 px-2 py-1 text-xs font-semibold capitalize text-stone-700"
                      style={{ width: m.days * dayWidth }}
                    >
                      {m.label}
                    </div>
                  ))}
                </div>
                <div className="flex">
                  {days.map((d, i) => {
                    const isToday = d.getTime() === today.getTime();
                    const showLabel = dayWidth >= 20 || d.getDay() === 1;
                    return (
                      <div
                        key={i}
                        className={clsx(
                          "shrink-0 py-1 text-center text-xs",
                          isWeekend(d) ? "text-stone-400" : "text-stone-600",
                          isToday && "font-semibold text-red-600 dark:text-red-400",
                        )}
                        style={{ width: dayWidth }}
                      >
                        {showLabel ? format(d, "d") : ""}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="relative">
              {/* Weekend shading + today marker */}
              <div className="pointer-events-none absolute inset-y-0" style={{ left: LEFT_WIDTH, width: timelineWidth }}>
                {dayWidth >= 8 &&
                  days.map((d, i) =>
                    isWeekend(d) ? (
                      <div
                        key={i}
                        className="absolute inset-y-0 bg-stone-50 dark:bg-stone-100"
                        style={{ left: i * dayWidth, width: dayWidth }}
                      />
                    ) : null,
                  )}
                <div
                  className="absolute inset-y-0 w-px bg-red-500"
                  style={{ left: todayOffset + dayWidth / 2 }}
                />
              </div>

              {rows.map((row) =>
                row.kind === "project" ? (
                  <div key={`p-${row.project.id}`} className="relative flex border-b border-stone-100 bg-stone-50/80" style={{ height: 32 }}>
                    <div
                      className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-stone-200 bg-stone-50 px-4 text-xs font-semibold text-stone-700"
                      style={{ width: LEFT_WIDTH }}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: row.project.color }} />
                      <span className="truncate">{row.project.name}</span>
                      <span className="text-stone-400">({row.count})</span>
                    </div>
                  </div>
                ) : (
                  <TaskRow
                    key={row.task.id}
                    task={row.task}
                    project={projectsById.get(row.task.projectId)}
                    columnName={columnsById.get(row.task.columnId)?.name ?? ""}
                    rangeStart={rangeStart}
                    dayWidth={dayWidth}
                    timelineWidth={timelineWidth}
                    drag={drag?.id === row.task.id ? drag : null}
                    onOpen={() => onOpenTask(row.task)}
                    onStartDrag={startDrag}
                    onPointerMove={onPointerMove}
                    onEndDrag={endDrag}
                    onSetDate={(date) => onChangeDates(row.task.id, date, date)}
                  />
                ),
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function applyDrag(span: { start: Date; end: Date }, drag: DragState) {
  if (drag.mode === "move") {
    return { start: addDays(span.start, drag.delta), end: addDays(span.end, drag.delta) };
  }
  if (drag.mode === "start") {
    const start = addDays(span.start, drag.delta);
    return { start: start > span.end ? span.end : start, end: span.end };
  }
  const end = addDays(span.end, drag.delta);
  return { start: span.start, end: end < span.start ? span.start : end };
}

function TaskRow({
  task,
  project,
  columnName,
  rangeStart,
  dayWidth,
  timelineWidth,
  drag,
  onOpen,
  onStartDrag,
  onPointerMove,
  onEndDrag,
  onSetDate,
}: {
  task: Task;
  project?: Project;
  columnName: string;
  rangeStart: Date;
  dayWidth: number;
  timelineWidth: number;
  drag: DragState | null;
  onOpen: () => void;
  onStartDrag: (e: React.PointerEvent, task: Task, mode: DragMode) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onEndDrag: (e: React.PointerEvent, task: Task) => void;
  onSetDate: (date: string) => void;
}) {
  const baseSpan = taskSpan(task);
  const span = baseSpan && drag ? applyDrag(baseSpan, drag) : baseSpan;
  const done = isDoneColumn(columnName);
  const color = project?.color ?? "#6366f1";

  return (
    <div className="group relative flex border-b border-stone-100" style={{ height: ROW_HEIGHT }}>
      <button
        onClick={onOpen}
        className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-stone-200 bg-surface px-4 text-left hover:bg-stone-50"
        style={{ width: LEFT_WIDTH }}
      >
        <span className={clsx("min-w-0 flex-1 truncate text-sm", done ? "text-stone-400 line-through" : "text-stone-800")}>
          {task.title}
        </span>
        <span className="shrink-0 text-xs text-stone-400">
          {columnName}
        </span>
      </button>

      <div
        className="relative"
        style={{ width: timelineWidth }}
        onClick={(e) => {
          if (baseSpan) return;
          const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
          onSetDate(format(addDays(rangeStart, Math.floor(x / dayWidth)), "yyyy-MM-dd"));
        }}
      >
        {span ? (
          <div
            className={clsx(
              "absolute top-1.5 flex select-none items-center overflow-hidden rounded text-xs font-medium text-white",
              drag ? "cursor-grabbing ring-2 ring-offset-1 ring-offset-surface" : "cursor-grab",
              done && "opacity-60",
            )}
            style={{
              left: differenceInCalendarDays(span.start, rangeStart) * dayWidth + 1,
              width: (differenceInCalendarDays(span.end, span.start) + 1) * dayWidth - 2,
              height: ROW_HEIGHT - 12,
              background: color,
              touchAction: "none",
            }}
            title={`${task.title}\n${format(span.start, "d MMM yyyy")} – ${format(span.end, "d MMM yyyy")}`}
            onPointerDown={(e) => onStartDrag(e, task, "move")}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => onEndDrag(e, task)}
          >
            <span
              className="absolute inset-y-0 left-0 w-2 cursor-ew-resize hover:bg-black/20"
              onPointerDown={(e) => onStartDrag(e, task, "start")}
            />
            <span className="pointer-events-none flex min-w-0 items-center gap-1 truncate px-2.5">
              {done && <Check size={12} className="shrink-0" />}
              {task.title}
            </span>
            <span
              className="absolute inset-y-0 right-0 w-2 cursor-ew-resize hover:bg-black/20"
              onPointerDown={(e) => onStartDrag(e, task, "end")}
            />
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-0 flex items-center px-3 text-xs text-stone-400 opacity-0 transition group-hover:opacity-100">
            Belum ada tanggal — klik di timeline untuk menjadwalkan
          </div>
        )}
      </div>
    </div>
  );
}
