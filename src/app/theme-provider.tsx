"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

const THEME_STORAGE_KEY = "project-rag-theme";
type Theme = "light" | "dark";
const ThemeToggleContext = createContext<() => void>(() => {});

function readSavedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const manualPreference = useRef(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const savedTheme = readSavedTheme();
    manualPreference.current = savedTheme !== null;
    applyTheme(savedTheme ?? (media.matches ? "dark" : "light"));

    function followSystemPreference() {
      if (!manualPreference.current) {
        applyTheme(media.matches ? "dark" : "light");
      }
    }

    media.addEventListener("change", followSystemPreference);
    return () => media.removeEventListener("change", followSystemPreference);
  }, []);

  const toggleTheme = useCallback(() => {
    const nextTheme: Theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    manualPreference.current = true;
    applyTheme(nextTheme);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Keep the selected theme for this page even if storage is disabled.
    }
  }, []);

  return (
    <ThemeToggleContext.Provider value={toggleTheme}>
      {children}
    </ThemeToggleContext.Provider>
  );
}

export function ThemeToggle() {
  const toggleTheme = useContext(ThemeToggleContext);

  return (
    <button
      aria-label="Alternar entre tema claro e escuro"
      className="inline-flex h-10 items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[var(--surface)] px-3 text-sm font-medium text-[color:var(--foreground)] shadow-sm backdrop-blur-xl transition hover:bg-[var(--surface-strong)] focus:outline-none focus:ring-4 focus:ring-blue-500/20"
      onClick={toggleTheme}
      title="Alternar entre tema claro e escuro"
      type="button"
    >
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="3.5" />
        <path strokeLinecap="round" d="M12 2.5v2m0 15v2m9.5-9.5h-2m-15 0h-2m16.22-6.72-1.42 1.42M6.7 17.3l-1.42 1.42m13.44 0-1.42-1.42M6.7 6.7 5.28 5.28" />
      </svg>
      <span className="theme-label-light">Escuro</span>
      <span className="theme-label-dark">Claro</span>
    </button>
  );
}
