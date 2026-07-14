const IMAGE_URL_MAX = 2000;

/** Parse an optional image URL from API/form input. Returns undefined if field omitted. */
export function parseImageUrlField(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  const url = String(raw).trim().slice(0, IMAGE_URL_MAX);
  if (!url) return null;
  if (/^\/uploads\//i.test(url)) return url;
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("Image URL must start with http:// or https://");
  }
  return url;
}
