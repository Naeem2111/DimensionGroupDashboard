import { prisma } from "@/lib/prisma";

export function slugifyClientName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || "client";
}

export function clientPortalPath(slug: string): string {
  return `/clients/${encodeURIComponent(slug)}`;
}

export async function resolveUniqueClientSlug(name: string, excludeId?: string): Promise<string> {
  const base = slugifyClientName(name);
  let slug = base;
  let n = 2;
  while (true) {
    const existing = await prisma.opsClient.findFirst({
      where: {
        slug,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return slug;
    slug = `${base}-${n}`;
    n += 1;
  }
}
