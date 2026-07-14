import fs from "node:fs/promises";
import path from "node:path";

export const CLIENT_LOGO_MAX_BYTES = 1024 * 1024;
export const CLIENT_LOGO_PUBLIC_DIR = "/uploads/clients";

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const ALLOWED_MIME = new Set(Object.keys(MIME_TO_EXT));

function uploadsDir(): string {
  return path.join(process.cwd(), "public", "uploads", "clients");
}

export function isAllowedClientLogoMime(mime: string): boolean {
  return ALLOWED_MIME.has(mime);
}

export function clientLogoExtension(mime: string): string | null {
  return MIME_TO_EXT[mime] ?? null;
}

export function clientLogoPublicPath(clientId: string, ext: string): string {
  return `${CLIENT_LOGO_PUBLIC_DIR}/${clientId}${ext}`;
}

export async function ensureClientLogoDir(): Promise<void> {
  await fs.mkdir(uploadsDir(), { recursive: true });
}

export async function removeClientLogoFiles(clientId: string): Promise<void> {
  const dir = uploadsDir();
  let entries: string[] = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return;
  }
  await Promise.all(
    entries
      .filter((name) => name.startsWith(`${clientId}.`))
      .map((name) => fs.unlink(path.join(dir, name)).catch(() => {}))
  );
}

export async function saveClientLogoFile(
  clientId: string,
  mime: string,
  bytes: Buffer
): Promise<string> {
  const ext = clientLogoExtension(mime);
  if (!ext) throw new Error("Unsupported image type");

  await ensureClientLogoDir();
  await removeClientLogoFiles(clientId);

  const filename = `${clientId}${ext}`;
  await fs.writeFile(path.join(uploadsDir(), filename), bytes);
  return clientLogoPublicPath(clientId, ext);
}
