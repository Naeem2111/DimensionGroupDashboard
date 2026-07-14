"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_THEME,
  THEME_COOKIE,
  type ThemePreference,
  isThemePreference,
  normalizeTheme,
} from "@/lib/theme";

function readThemeFromDom(): ThemePreference {
  if (typeof document === "undefined") return DEFAULT_THEME;
  return normalizeTheme(document.documentElement.dataset.theme);
}

function applyTheme(theme: ThemePreference) {
  document.documentElement.dataset.theme = theme;
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${365 * 24 * 60 * 60}; samesite=lax`;
}

/** Theme toggle for public pages — cookie + DOM only (no auth API). */
export function PublicThemeToggle() {
  const [theme, setTheme] = useState<ThemePreference>(DEFAULT_THEME);

  useEffect(() => {
    setTheme(readThemeFromDom());

    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("blocarch-theme");
    channel.onmessage = (event: MessageEvent<{ theme?: unknown }>) => {
      if (!isThemePreference(event.data?.theme)) return;
      document.documentElement.dataset.theme = event.data.theme;
      setTheme(event.data.theme);
    };
    return () => channel.close();
  }, []);

  function toggleTheme() {
    const next: ThemePreference = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    if (typeof BroadcastChannel !== "undefined") {
      new BroadcastChannel("blocarch-theme").postMessage({ theme: next });
    }
  }

  const isDark = theme === "dark";
  const label = isDark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={label}
      aria-label={label}
      className="client-portal-theme-btn inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04] text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-slate-200"
    >
      {isDark ? (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
          />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
          />
        </svg>
      )}
    </button>
  );
}
