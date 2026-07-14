/** Parse #RGB or #RRGGBB hex colour for avatar/logo backgrounds. */
export function parseHexColor(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const s = String(raw).trim();
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s)) return null;
  if (s.length === 4) {
    const r = s[1];
    const g = s[2];
    const b = s[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return s.toLowerCase();
}

export const DEFAULT_AVATAR_BG = "#334155";
