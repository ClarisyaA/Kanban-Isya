import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { isDoneColumn } from "./board";
import type { Column, Project, Task } from "./types";

export type ExportFormat = "xlsx" | "csv";
export type CsvContent = "summary" | "daily";

const PRIORITY: Record<Task["priority"], string> = { low: "Low", medium: "Medium", high: "High" };

const dayName = (d: Date) => format(d, "EEEE", { locale: localeId });
const iso = (d: Date) => format(d, "yyyy-MM-dd");

type Span = { start: Date; end: Date; days: number };

function taskSpan(t: Task): Span | null {
  const s = t.startDate ?? t.dueDate;
  const e = t.dueDate ?? t.startDate;
  if (!s || !e) return null;
  let start = parseISO(s);
  let end = parseISO(e);
  if (end < start) [start, end] = [end, start];
  return { start, end, days: differenceInCalendarDays(end, start) + 1 };
}

/** Status of a task relative to a given day. */
function statusOn(day: Date, span: Span | null, done: boolean) {
  if (done) return "Selesai";
  if (!span) return "Belum dijadwalkan";
  if (day < span.start) return "Belum mulai";
  if (day > span.end) return "Terlambat";
  return "Berjalan";
}

export type SummaryRow = {
  project: string;
  task: string;
  description: string;
  board: string;
  priority: string;
  start: Date | null;
  startDay: string;
  end: Date | null;
  endDay: string;
  duration: number | null;
  dayNumber: number | null; // "hari ke-" as of today, only while running
  remaining: number | null; // days left until due (negative = late)
  status: string;
};

export type DailyRow = {
  date: Date;
  day: string;
  project: string;
  task: string;
  board: string;
  priority: string;
  dayNumber: number;
  duration: number;
  status: string;
};

export function buildReport(
  tasks: Task[],
  projects: Project[],
  columns: Column[],
  projectIds: Set<string>,
  today = startOfDay(new Date()),
) {
  const projectOrder = new Map(projects.map((p, i) => [p.id, i]));
  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const columnById = new Map(columns.map((c) => [c.id, c]));

  const selected = tasks
    .filter((t) => projectIds.has(t.projectId))
    .map((t) => ({ t, span: taskSpan(t), column: columnById.get(t.columnId) }))
    .sort(
      (a, b) =>
        (projectOrder.get(a.t.projectId) ?? 0) - (projectOrder.get(b.t.projectId) ?? 0) ||
        (a.span?.start.getTime() ?? Infinity) - (b.span?.start.getTime() ?? Infinity) ||
        a.t.title.localeCompare(b.t.title),
    );

  const summary: SummaryRow[] = selected.map(({ t, span, column }) => {
    const done = isDoneColumn(column?.name ?? "");
    const status = statusOn(today, span, done);
    return {
      project: projectName.get(t.projectId) ?? "",
      task: t.title,
      description: t.description,
      board: column?.name ?? "",
      priority: PRIORITY[t.priority],
      start: span?.start ?? null,
      startDay: span ? dayName(span.start) : "",
      end: span?.end ?? null,
      endDay: span ? dayName(span.end) : "",
      duration: span?.days ?? null,
      dayNumber: span && status === "Berjalan" ? differenceInCalendarDays(today, span.start) + 1 : null,
      remaining: span && !done ? differenceInCalendarDays(span.end, today) : null,
      status,
    };
  });

  const daily: DailyRow[] = [];
  for (const { t, span, column } of selected) {
    if (!span) continue;
    const done = isDoneColumn(column?.name ?? "");
    for (let i = 0; i < span.days; i++) {
      const date = addDays(span.start, i);
      daily.push({
        date,
        day: dayName(date),
        project: projectName.get(t.projectId) ?? "",
        task: t.title,
        board: column?.name ?? "",
        priority: PRIORITY[t.priority],
        dayNumber: i + 1,
        duration: span.days,
        status: done
          ? "Selesai"
          : span.end < today
            ? "Terlambat"
            : date < today
              ? "Sudah lewat"
              : date.getTime() === today.getTime()
                ? "Hari ini"
                : "Mendatang",
      });
    }
  }
  daily.sort((a, b) => a.date.getTime() - b.date.getTime() || a.project.localeCompare(b.project));

  return { summary, daily };
}

const SUMMARY_COLUMNS: { header: string; width: number; value: (r: SummaryRow) => string | number | Date | null }[] = [
  { header: "Project", width: 18, value: (r) => r.project },
  { header: "Task", width: 36, value: (r) => r.task },
  { header: "Board / Status", width: 16, value: (r) => r.board },
  { header: "Prioritas", width: 10, value: (r) => r.priority },
  { header: "Tanggal mulai", width: 14, value: (r) => r.start },
  { header: "Hari mulai", width: 11, value: (r) => r.startDay },
  { header: "Tanggal selesai", width: 14, value: (r) => r.end },
  { header: "Hari selesai", width: 11, value: (r) => r.endDay },
  { header: "Durasi (hari)", width: 12, value: (r) => r.duration },
  { header: "Hari ke- (hari ini)", width: 16, value: (r) => r.dayNumber },
  { header: "Sisa hari", width: 10, value: (r) => r.remaining },
  { header: "Keterangan", width: 18, value: (r) => r.status },
  { header: "Deskripsi", width: 40, value: (r) => r.description },
];

const DAILY_COLUMNS: { header: string; width: number; value: (r: DailyRow) => string | number | Date }[] = [
  { header: "Tanggal", width: 12, value: (r) => r.date },
  { header: "Hari", width: 10, value: (r) => r.day },
  { header: "Project", width: 18, value: (r) => r.project },
  { header: "Task", width: 36, value: (r) => r.task },
  { header: "Board / Status", width: 16, value: (r) => r.board },
  { header: "Prioritas", width: 10, value: (r) => r.priority },
  { header: "Hari ke-", width: 9, value: (r) => r.dayNumber },
  { header: "Dari total (hari)", width: 15, value: (r) => r.duration },
  { header: "Keterangan", width: 18, value: (r) => r.status },
];

/* ---------- CSV ---------- */

function csvCell(v: string | number | Date | null) {
  if (v === null) return "";
  const s = v instanceof Date ? iso(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv<R>(rows: R[], cols: { header: string; value: (r: R) => string | number | Date | null }[]) {
  const lines = [cols.map((c) => csvCell(c.header)).join(",")];
  for (const r of rows) lines.push(cols.map((c) => csvCell(c.value(r))).join(","));
  // BOM so Excel reads UTF-8 correctly.
  return new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
}

/* ---------- Excel ---------- */

// Excel stores calendar dates without a timezone; build the Date in UTC so the day doesn't shift.
const excelDate = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

async function toXlsx(report: ReturnType<typeof buildReport>) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();

  const addSheet = <R>(
    name: string,
    rows: R[],
    cols: { header: string; width: number; value: (r: R) => string | number | Date | null }[],
  ) => {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = cols.map((c) => ({ header: c.header, width: c.width }));
    for (const r of rows) {
      ws.addRow(cols.map((c) => {
        const v = c.value(r);
        return v instanceof Date ? excelDate(v) : v;
      }));
    }
    ws.getRow(1).font = { bold: true };
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
    ws.eachRow((row, i) => {
      if (i === 1) return;
      row.eachCell((cell) => {
        if (cell.value instanceof Date) cell.numFmt = "dd/mm/yyyy";
      });
    });
  };

  addSheet("Ringkasan Task", report.summary, SUMMARY_COLUMNS);
  addSheet("Detail Harian", report.daily, DAILY_COLUMNS);

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

type ReportOptions = {
  tasks: Task[];
  projects: Project[];
  columns: Column[];
  projectIds: Set<string>;
  format: ExportFormat;
  csvContent: CsvContent;
};

export async function createReportFile(options: ReportOptions) {
  const report = buildReport(options.tasks, options.projects, options.columns, options.projectIds);

  const chosen = options.projects.filter((p) => options.projectIds.has(p.id));
  const label =
    chosen.length === options.projects.length
      ? "semua-project"
      : chosen.map((p) => p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")).join("_");
  const base = `laporan-${label || "project"}-${iso(new Date())}`;

  let blob: Blob;
  let filename: string;
  if (options.format === "xlsx") {
    blob = await toXlsx(report);
    filename = `${base}.xlsx`;
  } else if (options.csvContent === "daily") {
    blob = toCsv(report.daily, DAILY_COLUMNS);
    filename = `${base}-harian.csv`;
  } else {
    blob = toCsv(report.summary, SUMMARY_COLUMNS);
    filename = `${base}-ringkasan.csv`;
  }
  return { blob, filename };
}

export async function downloadReport(options: ReportOptions) {
  const { blob, filename } = await createReportFile(options);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
