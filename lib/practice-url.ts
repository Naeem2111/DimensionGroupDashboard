import { prisma } from "@/lib/prisma";

export const MANUAL_PRACTICE_URL_PREFIX = "manual://dimensiongroupglobal/lead/";

export function slugifyPracticeName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || "lead";
}

export function manualPracticeUrl(slug: string): string {
  return `${MANUAL_PRACTICE_URL_PREFIX}${slug}`;
}

/** Slug from directory or manual practice URLs. */
export function slugFromPracticeUrl(url: string): string {
  const m = url.match(/\/practice\/([^/]+)\/?$/);
  return m ? m[1] : "";
}

export function isManualPracticeUrl(url: string): boolean {
  return url.startsWith(MANUAL_PRACTICE_URL_PREFIX);
}

export async function resolveUniquePracticeSlug(name: string): Promise<string> {
  const base = slugifyPracticeName(name);
  let slug = base;
  let n = 2;

  while (true) {
    const url = manualPracticeUrl(slug);
    const existing = await prisma.architect.findFirst({
      where: {
        OR: [{ url }, { url: { endsWith: `/practice/${slug}` } }],
      },
      select: { id: true },
    });
    if (!existing) return slug;
    slug = `${base}-${n}`;
    n += 1;
  }
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
