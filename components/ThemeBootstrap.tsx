"use client";

import { useEffect } from "react";
import { THEME_COOKIE, type ThemePreference } from "@/lib/theme";

/** Keeps the theme cookie aligned with the user's saved preference (client-side only). */
export function ThemeBootstrap({ theme }: { theme: ThemePreference }) {
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${365 * 24 * 60 * 60}; samesite=lax`;
  }, [theme]);

  return null;
}
