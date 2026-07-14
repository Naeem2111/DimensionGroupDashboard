export type AthleteProfileVisual = {
  profilePhotoUrl: string | null;
  profilePhotoBgColor: string | null;
  profilePhotoTextTone: string | null;
};

export function athleteProfileVisual(
  athlete: {
    profilePhotoUrl?: string | null;
    profilePhotoBgColor?: string | null;
    profilePhotoTextTone?: string | null;
  } | null | undefined
): AthleteProfileVisual {
  return {
    profilePhotoUrl: athlete?.profilePhotoUrl ?? null,
    profilePhotoBgColor: athlete?.profilePhotoBgColor ?? null,
    profilePhotoTextTone: athlete?.profilePhotoTextTone ?? null,
  };
}
