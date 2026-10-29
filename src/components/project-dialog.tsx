"use client";

import clsx from "clsx";
import { Trash2, X } from "lucide-react";
import { useState } from "react";
import { PROJECT_COLORS, type Project } from "@/lib/types";

type Props = {
  project: Project | null; // null = create
  onSave: (values: { name: string; color: string }) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

export function ProjectDialog({ project, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(project?.name ?? "");
  const [color, setColor] = useState(project?.color ?? PROJECT_COLORS[0]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSave({ name: name.trim(), color });
        }}
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            {project ? "Edit project" : "Project baru"}
          </h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Nama project</span>
          <input
            autoFocus
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="mis. Insight"
          />
        </label>

        <span className="mb-1 mt-4 block text-xs font-medium text-slate-600">Warna</span>
        <div className="flex flex-wrap gap-2">
          {PROJECT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={clsx(
                "h-7 w-7 rounded-full ring-offset-2 transition",
                color === c && "ring-2 ring-slate-900",
              )}
              style={{ background: c }}
              aria-label={c}
            />
          ))}
        </div>

        {!project && (
          <p className="mt-4 text-xs text-slate-500">
            Project baru otomatis punya board <b>To Do</b>, <b>In Progress</b>, dan <b>Done</b>. Kamu
            bisa rename, hapus, atau tambah board lain.
          </p>
        )}

        <div className="mt-5 flex items-center gap-2">
          {project && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Hapus project "${project.name}" beserta semua board & task-nya?`)) {
                  onDelete(project.id);
                }
              }}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 size={15} /> Hapus
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Batal
            </button>
            <button type="submit" className="btn-primary" disabled={!name.trim()}>
              {project ? "Simpan" : "Buat project"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
