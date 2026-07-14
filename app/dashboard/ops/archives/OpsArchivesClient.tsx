"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AthleteAvatar } from "@/components/ops/AthleteAvatar";
import { ClientAvatar } from "@/components/ops/ClientAvatar";
import { ArchiveProjectDetailPanel } from "@/components/ops/ArchiveProjectDetailPanel";
import { asAvatarTextTone } from "@/lib/avatar-text-tone";
import {
  COMPLEXITY_LABELS,
  PROJECT_PHASE_LABELS,
  PROJECT_STATUS_LABELS,
  TASK_TYPE_LABELS,
} from "@/lib/ops-constants";
import { groupProjectsByClient } from "@/lib/ops-project-groups";

type FilterOption = {
  id: string;
  name: string;
  logoUrl?: string | null;
  logoBgColor?: string | null;
  logoTextTone?: string | null;
};
type FilterOptionAthlete = { id: string; fullName: string; athleteCode: string };

type ArchiveProject = {
  id: string;
  name: string;
  displayTitle?: string;
  stageLabel?: string;
  address: string | null;
  projectNumber: string;
  clientId: string;
  clientName: string;
  clientLogoUrl: string | null;
  clientLogoBgColor: string | null;
  clientLogoTextTone: string | null;
  assignedAthleteId: string | null;
  assignedAthleteName: string | null;
  assignedAthleteCode: string | null;
  profilePhotoUrl: string | null;
  profilePhotoBgColor: string | null;
  profilePhotoTextTone: string | null;
  currentStatus: keyof typeof PROJECT_STATUS_LABELS;
  currentStage: keyof typeof PROJECT_PHASE_LABELS;
  complexity: keyof typeof COMPLEXITY_LABELS;
  progressPercent: number | null;
  dueDate: string | null;
  handoverDate: string | null;
  completedAt: string | null;
  deadlineBeatenDays: number | null;
};

type ArchiveTask = {
  id: string;
  title: string;
  summary: string | null;
  completedAt: string;
  completedBy: string;
  profilePhotoUrl: string | null;
  profilePhotoBgColor: string | null;
  profilePhotoTextTone: string | null;
  boardTitle: string;
  projectName: string | null;
  projectNumber: string | null;
  clientId: string | null;
  clientName: string | null;
  clientLogoUrl: string | null;
  clientLogoBgColor: string | null;
  clientLogoTextTone: string | null;
  athleteName: string | null;
};

type LoggedCompletion = {
  id: string;
  submissionDate: string;
  athleteName: string;
  athleteCode: string;
  profilePhotoUrl: string | null;
  profilePhotoBgColor: string | null;
  profilePhotoTextTone: string | null;
  clientId: string;
  clientName: string;
  clientLogoUrl: string | null;
  clientLogoBgColor: string | null;
  clientLogoTextTone: string | null;
  projectName: string;
  projectNumber: string;
  projectPhase: keyof typeof PROJECT_PHASE_LABELS;
  taskType: keyof typeof TASK_TYPE_LABELS;
  taskTypes: string[];
  hoursWorked: number;
  completionPercent: number | null;
  completedSummary: string | null;
  loggedAt: string;
};

type ArchivesData = {
  projects: ArchiveProject[];
  tasks: ArchiveTask[];
  loggedCompletions: LoggedCompletion[];
  filterOptions: { clients: FilterOption[]; athletes: FilterOptionAthlete[] };
};

type TabId = "projects" | "tasks" | "logged";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function taskTypesLabel(row: LoggedCompletion): string {
  const types = row.taskTypes?.length ? row.taskTypes : [row.taskType];
  return types
    .map((t) => TASK_TYPE_LABELS[t as keyof typeof TASK_TYPE_LABELS] ?? t)
    .join(", ");
}

export function OpsArchivesClient() {
  const [data, setData] = useState<ArchivesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabId>("projects");
  const [clientFilterId, setClientFilterId] = useState("");
  const [athleteFilterId, setAthleteFilterId] = useState("");
  const [clients, setClients] = useState<FilterOption[]>([]);
  const [athletes, setAthletes] = useState<FilterOptionAthlete[]>([]);
  const [detailProjectId, setDetailProjectId] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([fetch("/api/ops/clients"), fetch("/api/ops/athletes")])
      .then(async ([cr, ar]) => {
        const cj = await cr.json();
        const aj = await ar.json();
        if (cj.clients) {
          setClients(
            cj.clients.map(
              (c: {
                id: string;
                name: string;
                logoUrl?: string | null;
                logoBgColor?: string | null;
                logoTextTone?: string | null;
              }) => ({
                id: c.id,
                name: c.name,
                logoUrl: c.logoUrl ?? null,
                logoBgColor: c.logoBgColor ?? null,
                logoTextTone: c.logoTextTone ?? null,
              })
            )
          );
        }
        if (aj.athletes) {
          setAthletes(
            aj.athletes.map((a: { id: string; fullName: string; athleteCode: string }) => ({
              id: a.id,
              fullName: a.fullName,
              athleteCode: a.athleteCode,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (clientFilterId) params.set("clientId", clientFilterId);
    if (athleteFilterId) params.set("athleteId", athleteFilterId);
    const qs = params.toString();
    const r = await fetch(`/api/ops/archives${qs ? `?${qs}` : ""}`);
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Failed to load archives");
      setLoading(false);
      return;
    }
    setData(j);
    setLoading(false);
  }, [clientFilterId, athleteFilterId]);

  useEffect(() => {
    void load();
  }, [load]);

  const projectsByClient = useMemo(() => {
    if (!data) return [];
    return groupProjectsByClient(data.projects, (p) => ({
      clientId: p.clientId,
      clientName: p.clientName,
      clientLogoUrl: p.clientLogoUrl,
      clientLogoBgColor: p.clientLogoBgColor,
      clientLogoTextTone: p.clientLogoTextTone,
    }));
  }, [data]);

  const tabCounts = useMemo(
    () => ({
      projects: data?.projects.length ?? 0,
      tasks: data?.tasks.length ?? 0,
      logged: data?.loggedCompletions.length ?? 0,
    }),
    [data]
  );

  const selectedFilterClient = clients.find((c) => c.id === clientFilterId) ?? null;
  const selectedFilterAthlete = athletes.find((a) => a.id === athleteFilterId) ?? null;

  if (loading && !data) {
    return <p className="text-sm text-slate-500">Loading archives…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-xs text-slate-400">
          Client / firm
          <select
            value={clientFilterId}
            onChange={(e) => setClientFilterId(e.target.value)}
            className="select-console mt-1 block min-w-[14rem] rounded-md px-3 py-2 text-sm"
          >
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-400">
          Athlete
          <select
            value={athleteFilterId}
            onChange={(e) => setAthleteFilterId(e.target.value)}
            className="select-console mt-1 block min-w-[14rem] rounded-md px-3 py-2 text-sm"
          >
            <option value="">All athletes</option>
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.fullName}
              </option>
            ))}
          </select>
        </label>
        {selectedFilterClient ? (
          <p className="flex items-center gap-2 pb-2 text-xs text-slate-400">
            <ClientAvatar
              name={selectedFilterClient.name}
              logoUrl={selectedFilterClient.logoUrl ?? null}
              backgroundColor={selectedFilterClient.logoBgColor ?? null}
              textTone={asAvatarTextTone(selectedFilterClient.logoTextTone)}
              size={22}
            />
            Filtering archives to {selectedFilterClient.name}
          </p>
        ) : null}
        {selectedFilterAthlete ? (
          <p className="pb-2 text-xs text-slate-400">
            Filtering archives to {selectedFilterAthlete.fullName}
            <span className="block text-slate-500">{selectedFilterAthlete.athleteCode}</span>
          </p>
        ) : null}
        {loading ? <p className="pb-2 text-xs text-slate-500">Refreshing…</p> : null}
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="flex flex-wrap gap-2 border-b border-white/[0.06] pb-3">
        {(
          [
            ["projects", "Completed projects", tabCounts.projects],
            ["tasks", "Kanban tasks", tabCounts.tasks],
            ["logged", "Daily log completions", tabCounts.logged],
          ] as const
        ).map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ring-1 transition-colors ${
              tab === id
                ? "bg-brand-500/20 text-brand-200 ring-brand-500/30"
                : "bg-white/[0.04] text-slate-400 ring-white/[0.08] hover:bg-white/[0.07]"
            }`}
          >
            {label}
            <span className="ml-1.5 text-slate-500">({count})</span>
          </button>
        ))}
      </div>

      {tab === "projects" ? (
        <div className="space-y-8">
          {projectsByClient.length === 0 ? (
            <p className="text-sm text-slate-500">No completed projects match these filters.</p>
          ) : (
            projectsByClient.map((group) => (
              <section key={group.clientId} className="space-y-3">
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
                      {group.projects.length} archived project{group.projects.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-xl ring-1 ring-white/[0.06]">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-white/[0.03] text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">Project</th>
                        <th className="px-4 py-3 font-medium">Completed by</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Completed</th>
                        <th className="px-4 py-3 font-medium">Handover</th>
                        <th className="px-4 py-3 font-medium">Progress</th>
                        <th className="px-4 py-3 font-medium" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {group.projects.map((p) => (
                        <tr key={p.id} className="bg-white/[0.02]">
                          <td className="px-4 py-3">
                            <p className="font-medium text-white">{p.displayTitle ?? p.name}</p>
                            <p className="text-xs text-slate-500">
                              {p.projectNumber}
                              {p.address ? ` · ${p.address}` : ""} · {COMPLEXITY_LABELS[p.complexity]}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {p.assignedAthleteName ? (
                              <span className="inline-flex items-center gap-2">
                                <AthleteAvatar
                                  name={p.assignedAthleteName}
                                  photoUrl={p.profilePhotoUrl}
                                  backgroundColor={p.profilePhotoBgColor}
                                  textTone={asAvatarTextTone(p.profilePhotoTextTone)}
                                  size={24}
                                />
                                <span>
                                  {p.assignedAthleteName}
                                  {p.assignedAthleteCode ? (
                                    <span className="block text-xs text-slate-500">{p.assignedAthleteCode}</span>
                                  ) : null}
                                </span>
                              </span>
                            ) : (
                              "Unassigned"
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {PROJECT_STATUS_LABELS[p.currentStatus]}
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {formatDate(p.completedAt ?? p.handoverDate)}
                            {p.deadlineBeatenDays != null && p.deadlineBeatenDays > 0 ? (
                              <span className="block text-xs text-brand-300">
                                {p.deadlineBeatenDays} day{p.deadlineBeatenDays === 1 ? "" : "s"} early
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-slate-300">{formatDate(p.handoverDate)}</td>
                          <td className="px-4 py-3 text-slate-300">{p.progressPercent ?? "—"}%</td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setDetailProjectId(p.id)}
                              className="text-xs text-brand-300 hover:text-brand-200"
                            >
                              Open
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))
          )}
        </div>
      ) : null}

      {tab === "tasks" ? (
        <div className="overflow-x-auto rounded-xl ring-1 ring-white/[0.06]">
          {(data?.tasks.length ?? 0) === 0 ? (
            <p className="p-4 text-sm text-slate-500">No completed kanban tasks match these filters.</p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Task</th>
                  <th className="px-4 py-3 font-medium">Completed by</th>
                  <th className="px-4 py-3 font-medium">Client / project</th>
                  <th className="px-4 py-3 font-medium">Board</th>
                  <th className="px-4 py-3 font-medium">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {data?.tasks.map((t) => (
                  <tr key={t.id} className="bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{t.title}</p>
                      {t.summary ? <p className="mt-1 text-xs text-slate-500">{t.summary}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      <span className="inline-flex items-center gap-2">
                        <AthleteAvatar
                          name={t.completedBy}
                          photoUrl={t.profilePhotoUrl}
                          backgroundColor={t.profilePhotoBgColor}
                          textTone={asAvatarTextTone(t.profilePhotoTextTone)}
                          size={24}
                        />
                        <span>
                          {t.completedBy}
                          {t.athleteName && t.athleteName !== t.completedBy ? (
                            <span className="block text-xs text-slate-500">Board: {t.athleteName}</span>
                          ) : null}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {t.clientName ? (
                        <div className="flex items-center gap-2">
                          <ClientAvatar
                            name={t.clientName}
                            logoUrl={t.clientLogoUrl}
                            backgroundColor={t.clientLogoBgColor}
                            textTone={asAvatarTextTone(t.clientLogoTextTone)}
                            size={24}
                          />
                          <div>
                            <p className="text-slate-300">{t.clientName}</p>
                            {t.projectName ? (
                              <p className="text-xs text-slate-500">
                                {t.projectName}
                                {t.projectNumber ? ` · ${t.projectNumber}` : ""}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{t.boardTitle}</td>
                    <td className="px-4 py-3 text-slate-300">{formatDateTime(t.completedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}

      {tab === "logged" ? (
        <div className="overflow-x-auto rounded-xl ring-1 ring-white/[0.06]">
          {(data?.loggedCompletions.length ?? 0) === 0 ? (
            <p className="p-4 text-sm text-slate-500">No 100% daily log entries match these filters.</p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Athlete</th>
                  <th className="px-4 py-3 font-medium">Client / project</th>
                  <th className="px-4 py-3 font-medium">Work logged</th>
                  <th className="px-4 py-3 font-medium">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {data?.loggedCompletions.map((row) => (
                  <tr key={row.id} className="bg-white/[0.02]">
                    <td className="px-4 py-3 text-slate-300">{row.submissionDate}</td>
                    <td className="px-4 py-3 text-slate-300">
                      <span className="inline-flex items-center gap-2">
                        <AthleteAvatar
                          name={row.athleteName}
                          photoUrl={row.profilePhotoUrl}
                          backgroundColor={row.profilePhotoBgColor}
                          textTone={asAvatarTextTone(row.profilePhotoTextTone)}
                          size={24}
                        />
                        <span>
                          {row.athleteName}
                          <span className="block text-xs text-slate-500">{row.athleteCode}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ClientAvatar
                          name={row.clientName}
                          logoUrl={row.clientLogoUrl}
                          backgroundColor={row.clientLogoBgColor}
                          textTone={asAvatarTextTone(row.clientLogoTextTone)}
                          size={24}
                        />
                        <div>
                          <p className="text-slate-300">{row.clientName}</p>
                          <p className="text-xs text-slate-500">
                            {row.projectName} · {row.projectNumber}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      <p>{taskTypesLabel(row)}</p>
                      <p className="text-xs text-slate-500">
                        {PROJECT_PHASE_LABELS[row.projectPhase]} · {row.hoursWorked}h ·{" "}
                        {row.completionPercent ?? 100}%
                      </p>
                    </td>
                    <td className="max-w-xs px-4 py-3 text-slate-400">
                      {row.completedSummary || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
      {detailProjectId ? (
        <ArchiveProjectDetailPanel projectId={detailProjectId} onClose={() => setDetailProjectId(null)} />
      ) : null}
    </div>
  );
}
