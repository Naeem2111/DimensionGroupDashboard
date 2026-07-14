"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClientAvatar } from "@/components/ops/ClientAvatar";
import { asAvatarTextTone } from "@/lib/avatar-text-tone";
import {
  COMPLEXITY_LABELS,
  PROJECT_PHASE_LABELS,
  PROJECT_STATUS_LABELS,
} from "@/lib/ops-constants";
import { clientMetaFromNestedClient, groupProjectsByClient } from "@/lib/ops-project-groups";

type ProjectClient = {
  id: string;
  name: string;
  logoUrl: string | null;
  logoBgColor: string | null;
  logoTextTone: string | null;
};

type ProjectRow = {
  id: string;
  name: string;
  projectNumber: string;
  complexity: keyof typeof COMPLEXITY_LABELS;
  currentStage: keyof typeof PROJECT_PHASE_LABELS;
  currentStatus: keyof typeof PROJECT_STATUS_LABELS;
  startDate: string | null;
  dueDate: string | null;
  handoverDate: string | null;
  progressPercent: number | null;
  client: ProjectClient;
};

export function CompletedProjectsClient() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [clientFilterId, setClientFilterId] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/athlete/projects/completed");
    const j = await r.json();
    if (r.ok) setProjects(j.projects || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const clientOptions = useMemo(() => {
    const map = new Map<string, ProjectClient>();
    for (const p of projects) {
      if (!map.has(p.client.id)) map.set(p.client.id, p.client);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  const filteredProjects = useMemo(() => {
    if (!clientFilterId) return projects;
    return projects.filter((p) => p.client.id === clientFilterId);
  }, [projects, clientFilterId]);

  const projectsByClient = useMemo(
    () => groupProjectsByClient(filteredProjects, (p) => clientMetaFromNestedClient(p.client)),
    [filteredProjects]
  );

  const selectedFilterClient = clientOptions.find((c) => c.id === clientFilterId) ?? null;

  async function reactivate(projectId: string, name: string) {
    if (
      !window.confirm(
        `Move "${name}" back to My Projects? Progress will reset from 100% to 90% so you can keep logging daily work.`
      )
    ) {
      return;
    }
    setBusyId(projectId);
    setMsg("");
    try {
      const r = await fetch(`/api/athlete/projects/${encodeURIComponent(projectId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentStatus: "in_progress" }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        window.alert((j as { error?: string }).error || "Could not reactivate project");
        return;
      }
      setMsg(`"${name}" is active again in My Projects.`);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading completed projects…</p>;

  if (projects.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No completed projects yet. When a project reaches 100% in the Daily Log, it appears here
        automatically.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <p className="pb-2 text-sm text-slate-400">
          {filteredProjects.length} completed project{filteredProjects.length === 1 ? "" : "s"}
          {clientFilterId
            ? ` for ${selectedFilterClient?.name ?? "client"}`
            : ` · ${projectsByClient.length} client${projectsByClient.length === 1 ? "" : "s"}`}
        </p>
        <label className="text-xs text-slate-400">
          Client / firm
          <select
            value={clientFilterId}
            onChange={(e) => setClientFilterId(e.target.value)}
            className="select-console mt-1 block min-w-[14rem] rounded-md px-3 py-2 text-sm"
          >
            <option value="">All clients</option>
            {clientOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {selectedFilterClient ? (
          <p className="flex items-center gap-2 pb-2 text-xs text-slate-400">
            <ClientAvatar
              name={selectedFilterClient.name}
              logoUrl={selectedFilterClient.logoUrl}
              backgroundColor={selectedFilterClient.logoBgColor}
              textTone={asAvatarTextTone(selectedFilterClient.logoTextTone)}
              size={22}
            />
            Showing {selectedFilterClient.name} only
          </p>
        ) : null}
      </div>

      {msg ? <p className="text-sm text-brand-300">{msg}</p> : null}

      {filteredProjects.length === 0 ? (
        <p className="text-sm text-slate-500">No completed projects for this client.</p>
      ) : (
        <div className="space-y-8">
          {projectsByClient.map((group) => (
            <section key={group.clientId} className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] pb-2">
                <ClientAvatar
                  name={group.clientName}
                  logoUrl={group.clientLogoUrl}
                  backgroundColor={group.clientLogoBgColor}
                  textTone={asAvatarTextTone(group.clientLogoTextTone)}
                  size={36}
                />
                <div>
                  <h2 className="text-sm font-semibold text-white">{group.clientName}</h2>
                  <p className="text-xs text-slate-500">
                    {group.projects.length} project{group.projects.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <ul className="space-y-4">
                {group.projects.map((p) => (
                  <li key={p.id} className="card-tool rounded-xl p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="font-semibold text-white">{p.name}</h2>
                        <p className="text-xs text-slate-500">{p.projectNumber}</p>
                      </div>
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.06]">
                        <input
                          type="checkbox"
                          checked={false}
                          disabled={busyId === p.id}
                          onChange={(e) => {
                            if (e.target.checked) void reactivate(p.id, p.name);
                          }}
                          className="h-3.5 w-3.5 rounded border-white/20 bg-white/[0.06] text-brand-500"
                        />
                        <span>Still in progress</span>
                      </label>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                      <div>
                        <dt className="text-slate-500">Status</dt>
                        <dd className="text-slate-200">{PROJECT_STATUS_LABELS[p.currentStatus]}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Stage</dt>
                        <dd className="text-slate-200">{PROJECT_PHASE_LABELS[p.currentStage]}</dd>
                      </div>
                      {p.handoverDate ? (
                        <div>
                          <dt className="text-slate-500">Handover</dt>
                          <dd className="text-slate-200">{p.handoverDate}</dd>
                        </div>
                      ) : null}
                      {p.progressPercent != null ? (
                        <div>
                          <dt className="text-slate-500">Final progress</dt>
                          <dd className="text-slate-200">{p.progressPercent}%</dd>
                        </div>
                      ) : null}
                    </dl>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
