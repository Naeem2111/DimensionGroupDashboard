/** Initials / fallback label colour on avatar circles. */
export type AvatarTextTone = "light" | "dark";

export const DEFAULT_AVATAR_TEXT_TONE: AvatarTextTone = "light";

export function parseAvatarTextTone(raw: unknown): AvatarTextTone | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  const v = String(raw).trim().toLowerCase();
  if (v === "light" || v === "dark") return v;
  return null;
}

export function asAvatarTextTone(raw: string | null | undefined): AvatarTextTone | null {
  if (raw === "light" || raw === "dark") return raw;
  return null;
}

export function avatarInitialsTextClass(
  tone: AvatarTextTone | null | undefined,
  hasCustomBg: boolean
): string {
  if (!hasCustomBg) return "text-slate-300";
  const t = tone ?? DEFAULT_AVATAR_TEXT_TONE;
  return t === "dark" ? "text-slate-950" : "text-white";
}
