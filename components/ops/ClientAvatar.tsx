import { avatarInitials } from "@/lib/avatar-initials";
import { avatarInitialsTextClass, type AvatarTextTone } from "@/lib/avatar-text-tone";

type ClientAvatarProps = {
  name: string;
  logoUrl?: string | null;
  /** Circle background when logo is transparent or for initials fallback. */
  backgroundColor?: string | null;
  /** Initials colour when no logo image — light (white) or dark (black). */
  textTone?: AvatarTextTone | null;
  size?: number;
  className?: string;
  /** contain fits full logos inside the box; cover fills circular profile photos. */
  objectFit?: "contain" | "cover";
};

function normalizedBg(backgroundColor?: string | null): string | null {
  const v = backgroundColor?.trim();
  return v || null;
}

export function ClientAvatar({
  name,
  logoUrl,
  backgroundColor,
  textTone,
  size = 36,
  className = "",
  objectFit = "contain",
}: ClientAvatarProps) {
  const bg = normalizedBg(backgroundColor);
  const style: React.CSSProperties = {
    width: size,
    height: size,
    ...(bg ? { backgroundColor: bg } : {}),
  };
  const initials = avatarInitials(name);
  const fontSize = size <= 32 ? "0.65rem" : size <= 40 ? "0.7rem" : "0.75rem";
  const shellClass = bg
    ? "avatar-circle avatar-circle-custom inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-black/10"
    : "avatar-circle inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/10";
  const initialsClass = avatarInitialsTextClass(textTone, !!bg);

  if (logoUrl) {
    return (
      <span className={`${shellClass} ${className}`} style={style}>
        <img
          src={logoUrl}
          alt=""
          width={size}
          height={size}
          className={`h-full w-full ${objectFit === "cover" ? "object-cover" : "object-contain p-1"}`}
        />
      </span>
    );
  }

  return (
    <span
      className={`${shellClass} font-semibold ${initialsClass} ${className}`}
      style={{ ...style, fontSize }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
