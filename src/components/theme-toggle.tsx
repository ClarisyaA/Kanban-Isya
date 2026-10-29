"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";

const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<Theme, string> = { system: "Sistem", light: "Terang", dark: "Gelap" };

/** Runs in <head> before paint so a dark-mode user never sees a white flash. */
export const themeScript = `(function(){try{var t=localStorage.getItem("theme");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    let saved: Theme = "system";
    try {
      const t = localStorage.getItem("theme");
      if (t === "light" || t === "dark") saved = t;
    } catch {}
    setTheme(saved);
  }, []);

  useEffect(() => {
    if (!theme) return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.classList.toggle(
        "dark",
        theme === "dark" || (theme === "system" && media.matches),
      );
    apply();
    try {
      if (theme === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", theme);
    } catch {}
    if (theme !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  const current = theme ?? "system";
  const Icon = current === "dark" ? Moon : current === "light" ? Sun : Monitor;
  return (
    <button
      className="icon-btn"
      onClick={() => setTheme(NEXT[current])}
      title={`Tema: ${LABEL[current]} (klik untuk ganti)`}
      aria-label={`Tema: ${LABEL[current]}`}
    >
      <Icon size={16} />
    </button>
  );
}
