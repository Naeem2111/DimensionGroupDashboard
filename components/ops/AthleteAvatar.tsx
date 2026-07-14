import { ClientAvatar } from "@/components/ops/ClientAvatar";
import type { AvatarTextTone } from "@/lib/avatar-text-tone";

type AthleteAvatarProps = {
  name: string;
  photoUrl?: string | null;
  backgroundColor?: string | null;
  textTone?: AvatarTextTone | null;
  size?: number;
  className?: string;
};

export function AthleteAvatar({
  name,
  photoUrl,
  backgroundColor,
  textTone,
  size = 36,
  className = "",
}: AthleteAvatarProps) {
  return (
    <ClientAvatar
      name={name}
      logoUrl={photoUrl}
      backgroundColor={backgroundColor}
      textTone={textTone}
      size={size}
      className={className}
      objectFit="cover"
    />
  );
}
