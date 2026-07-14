export type SidebarNavOrder = {
  sections: string[];
  items: Record<string, string[]>;
  /** Section ids that are collapsed in the sidebar. */
  collapsedSections?: string[];
};

const STORAGE_PREFIX = "blocharch.sidebar-order.v1:";

export function sidebarNavStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function loadSidebarNavOrder(userId: string): SidebarNavOrder | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(sidebarNavStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SidebarNavOrder>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      sections: Array.isArray(parsed.sections)
        ? parsed.sections.filter((id): id is string => typeof id === "string")
        : [],
      items:
        parsed.items && typeof parsed.items === "object"
          ? Object.fromEntries(
              Object.entries(parsed.items).filter(
                (entry): entry is [string, string[]] =>
                  typeof entry[0] === "string" &&
                  Array.isArray(entry[1]) &&
                  entry[1].every((h) => typeof h === "string")
              )
            )
          : {},
      collapsedSections: Array.isArray(parsed.collapsedSections)
        ? parsed.collapsedSections.filter((id): id is string => typeof id === "string")
        : [],
    };
  } catch {
    return null;
  }
}

export function saveSidebarNavOrder(userId: string, order: SidebarNavOrder): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(sidebarNavStorageKey(userId), JSON.stringify(order));
}

export function applySectionOrder<T extends { id: string }>(
  sections: T[],
  order: string[] | null | undefined
): T[] {
  if (!order?.length) return sections;
  const map = new Map(sections.map((s) => [s.id, s]));
  const out: T[] = [];
  for (const id of order) {
    const s = map.get(id);
    if (s) {
      out.push(s);
      map.delete(id);
    }
  }
  for (const s of Array.from(map.values())) out.push(s);
  return out;
}

export function applyItemOrder<T extends { href: string }>(
  items: T[],
  order: string[] | null | undefined
): T[] {
  if (!order?.length) return items;
  const map = new Map(items.map((i) => [i.href, i]));
  const out: T[] = [];
  for (const href of order) {
    const item = map.get(href);
    if (item) {
      out.push(item);
      map.delete(href);
    }
  }
  for (const item of Array.from(map.values())) out.push(item);
  return out;
}

export function reorderIds(ids: string[], fromIndex: number, toIndex: number): string[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= ids.length || toIndex >= ids.length) {
    return ids;
  }
  const next = [...ids];
  const [removed] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, removed);
  return next;
}
