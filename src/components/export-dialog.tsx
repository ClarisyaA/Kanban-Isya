"use client";

import clsx from "clsx";
import { Loader2, X } from "lucide-react";
import { useState } from "react";
import { downloadReport, type CsvContent, type ExportFormat } from "@/lib/export";
import type { Column, Project, Task } from "@/lib/types";

type Props = {
  projects: Project[];
  columns: Column[];
  tasks: Task[];
  initialProjectId: string | null; // null = all projects
  onClose: () => void;
};

export function ExportDialog({ projects, columns, tasks, initialProjectId, onClose }: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialProjectId ? [initialProjectId] : projects.map((p) => p.id)),
  );
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [csvContent, setCsvContent] = useState<CsvContent>("summary");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allSelected = selected.size === projects.length;
  const taskCount = tasks.filter((t) => selected.has(t.projectId)).length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function download() {
    setBusy(true);
    setError(null);
    try {
      await downloadReport({ tasks, projects, columns, projectIds: selected, format, csvContent });
      onClose();
    } catch (e) {
      console.error(e);
      setError("Gagal membuat file. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-lg bg-surface p-5 shadow-xl sm:rounded-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-stone-900">Download laporan</h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p className="mb-2 text-xs font-medium text-stone-600">Project</p>
        <div className="rounded-lg border border-stone-200">
          <label className="flex cursor-pointer items-center gap-2.5 border-b border-stone-200 px-3 py-2 text-sm font-medium text-stone-900">
            <input
              type="checkbox"
              className="h-4 w-4 accent-stone-900"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = !allSelected && selected.size > 0;
              }}
              onChange={() => setSelected(new Set(allSelected ? [] : projects.map((p) => p.id)))}
            />
            Semua project
          </label>
          <div className="max-h-48 overflow-y-auto py-1">
            {projects.map((p) => (
              <label
                key={p.id}
                className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-stone-900"
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                />
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
                <span className="truncate">{p.name}</span>
              </label>
            ))}
          </div>
        </div>

        <p className="mb-2 mt-4 text-xs font-medium text-stone-600">Format</p>
        <div className="grid grid-cols-2 gap-2">
          <Choice active={format === "xlsx"} onClick={() => setFormat("xlsx")} title="Excel (.xlsx)">
            Sheet ringkasan task + detail per hari
          </Choice>
          <Choice active={format === "csv"} onClick={() => setFormat("csv")} title="CSV">
            Satu tabel, pilih isinya
          </Choice>
        </div>

        {format === "csv" && (
          <div className="mt-3 space-y-1.5 text-sm text-stone-700">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                className="accent-stone-900"
                checked={csvContent === "summary"}
                onChange={() => setCsvContent("summary")}
              />
              Ringkasan per task (1 baris per task)
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                className="accent-stone-900"
                checked={csvContent === "daily"}
                onChange={() => setCsvContent("daily")}
              />
              Detail per hari (1 baris per task per tanggal)
            </label>
          </div>
        )}

        {error && <p className="mt-3 rounded-md bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="mt-5 flex items-center gap-2">
          <span className="text-xs text-stone-500">{taskCount} task</span>
          <div className="ml-auto flex gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Batal
            </button>
            <button
              type="button"
              className="btn-primary flex items-center gap-1.5"
              disabled={selected.size === 0 || busy}
              onClick={download}
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Choice({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "rounded-lg border px-3 py-2 text-left transition",
        active ? "border-stone-900" : "border-stone-200 hover:border-stone-400",
      )}
    >
      <span className="block text-sm font-medium text-stone-900">{title}</span>
      <span className="block text-xs text-stone-500">{children}</span>
    </button>
  );
}
