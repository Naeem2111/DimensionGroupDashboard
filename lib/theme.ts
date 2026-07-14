export type ThemePreference = "dark" | "light";

export const THEME_COOKIE = "blocarch_theme";
export const DEFAULT_THEME: ThemePreference = "dark";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "dark" || value === "light";
}

export function normalizeTheme(value: unknown): ThemePreference {
  return isThemePreference(value) ? value : DEFAULT_THEME;
}

export function themeCookieMaxAge(): number {
  return 365 * 24 * 60 * 60;
}
