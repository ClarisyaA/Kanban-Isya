"use client";

import { Trash2, X } from "lucide-react";
import { useState } from "react";
import { normalizeName } from "@/lib/board";
import type { Column, Priority, Project, Task } from "@/lib/types";

type Props = {
  task: Task;
  isNew: boolean;
  projects: Project[];
  columns: Column[];
  onSave: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onClose: () => void;
};

export function TaskDialog({ task, isNew, projects, columns, onSave, onDelete, onClose }: Props) {
  const [draft, setDraft] = useState<Task>(task);
  const [error, setError] = useState<string | null>(null);

  const projectColumns = columns
    .filter((c) => c.projectId === draft.projectId)
    .sort((a, b) => a.position - b.position);

  function changeProject(projectId: string) {
    // Keep the same board name (e.g. "In Progress") when switching projects if possible.
    const currentName = columns.find((c) => c.id === draft.columnId)?.name ?? "";
    const target = columns
      .filter((c) => c.projectId === projectId)
      .sort((a, b) => a.position - b.position);
    const match = target.find((c) => normalizeName(c.name) === normalizeName(currentName)) ?? target[0];
    setDraft({ ...draft, projectId, columnId: match?.id ?? "" });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.title.trim()) return setError("Judul wajib diisi");
    if (!draft.columnId) return setError("Project ini belum punya board. Tambahkan board dulu.");
    if (draft.startDate && draft.dueDate && draft.dueDate < draft.startDate) {
      return setError("Tanggal selesai tidak boleh sebelum tanggal mulai");
    }
    onSave({ ...draft, title: draft.title.trim() });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={submit}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-lg bg-surface p-5 shadow-xl sm:rounded-lg"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-stone-900">{isNew ? "Task baru" : "Edit task"}</h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Judul">
            <input
              autoFocus
              className="input"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Apa yang perlu dikerjakan?"
            />
          </Field>

          <Field label="Deskripsi">
            <textarea
              className="input min-h-20 resize-y"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Detail tambahan (opsional)"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Project">
              <select className="input" value={draft.projectId} onChange={(e) => changeProject(e.target.value)}>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Board / status">
              <select
                className="input"
                value={draft.columnId}
                onChange={(e) => setDraft({ ...draft, columnId: e.target.value })}
              >
                {projectColumns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Prioritas">
              <select
                className="input"
                value={draft.priority}
                onChange={(e) => setDraft({ ...draft, priority: e.target.value as Priority })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </Field>
            <Field label="Mulai">
              <input
                type="date"
                className="input"
                value={draft.startDate ?? ""}
                onChange={(e) => setDraft({ ...draft, startDate: e.target.value || null })}
              />
            </Field>
            <Field label="Selesai">
              <input
                type="date"
                className="input"
                value={draft.dueDate ?? ""}
                min={draft.startDate ?? undefined}
                onChange={(e) => setDraft({ ...draft, dueDate: e.target.value || null })}
              />
            </Field>
          </div>

          {error && <p className="rounded-md bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="mt-5 flex items-center gap-2">
          {!isNew && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Hapus task "${task.title}"?`)) onDelete(task.id);
              }}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
            >
              <Trash2 size={15} /> Hapus
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Batal
            </button>
            <button type="submit" className="btn-primary">
              {isNew ? "Tambah" : "Simpan"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-stone-600">{label}</span>
      {children}
    </label>
  );
}
