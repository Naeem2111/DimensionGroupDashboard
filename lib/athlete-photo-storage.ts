import fs from "node:fs/promises";
import path from "node:path";

export const ATHLETE_PHOTO_MAX_BYTES = 1024 * 1024;
export const ATHLETE_PHOTO_PUBLIC_DIR = "/uploads/athletes";

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const ALLOWED_MIME = new Set(Object.keys(MIME_TO_EXT));

function uploadsDir(): string {
  return path.join(process.cwd(), "public", "uploads", "athletes");
}

export function isAllowedAthletePhotoMime(mime: string): boolean {
  return ALLOWED_MIME.has(mime);
}

export function athletePhotoExtension(mime: string): string | null {
  return MIME_TO_EXT[mime] ?? null;
}

export async function ensureAthletePhotoDir(): Promise<void> {
  await fs.mkdir(uploadsDir(), { recursive: true });
}

export async function removeAthletePhotoFiles(athleteId: string): Promise<void> {
  const dir = uploadsDir();
  let entries: string[] = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return;
  }
  await Promise.all(
    entries
      .filter((name) => name.startsWith(`${athleteId}.`))
      .map((name) => fs.unlink(path.join(dir, name)).catch(() => {}))
  );
}

export async function saveAthletePhotoFile(
  athleteId: string,
  mime: string,
  bytes: Buffer
): Promise<string> {
  const ext = athletePhotoExtension(mime);
  if (!ext) throw new Error("Unsupported image type");

  await ensureAthletePhotoDir();
  await removeAthletePhotoFiles(athleteId);

  const filename = `${athleteId}${ext}`;
  await fs.writeFile(path.join(uploadsDir(), filename), bytes);
  return `${ATHLETE_PHOTO_PUBLIC_DIR}/${athleteId}${ext}`;
}
