"use client";

import { KanbanSquare, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn, signUp } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } =
      mode === "signin"
        ? await signIn.email({ email, password })
        : await signUp.email({ name: name || email.split("@")[0], email, password });
    setLoading(false);
    if (error) {
      setError(error.message ?? "Terjadi kesalahan");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <KanbanSquare size={20} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Kanban Board</h1>
            <p className="text-xs text-slate-500">Board & timeline untuk semua project</p>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={`rounded-md py-1.5 font-medium transition ${
                mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              {m === "signin" ? "Masuk" : "Daftar"}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          {mode === "signup" && (
            <Field label="Nama">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="Nama kamu"
              />
            </Field>
          )}
          <Field label="Email">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="kamu@email.com"
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="Minimal 8 karakter"
            />
          </Field>

          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex w-full items-center justify-center gap-2 py-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {mode === "signin" ? "Masuk" : "Buat akun"}
          </button>
        </form>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
