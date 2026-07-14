export type ProjectClientMeta = {
  clientId: string;
  clientName: string;
  clientLogoUrl: string | null;
  clientLogoBgColor: string | null;
  clientLogoTextTone: string | null;
};

export type ProjectClientGroup<T> = ProjectClientMeta & { projects: T[] };

export function groupProjectsByClient<T>(
  projects: T[],
  getMeta: (project: T) => ProjectClientMeta
): ProjectClientGroup<T>[] {
  const groups = new Map<string, ProjectClientGroup<T>>();
  for (const project of projects) {
    const meta = getMeta(project);
    const existing = groups.get(meta.clientId);
    if (existing) {
      existing.projects.push(project);
    } else {
      groups.set(meta.clientId, { ...meta, projects: [project] });
    }
  }
  return Array.from(groups.values()).sort((a, b) => a.clientName.localeCompare(b.clientName));
}

export function clientMetaFromNestedClient(client: {
  id: string;
  name: string;
  logoUrl?: string | null;
  logoBgColor?: string | null;
  logoTextTone?: string | null;
}): ProjectClientMeta {
  return {
    clientId: client.id,
    clientName: client.name,
    clientLogoUrl: client.logoUrl ?? null,
    clientLogoBgColor: client.logoBgColor ?? null,
    clientLogoTextTone: client.logoTextTone ?? null,
  };
}
