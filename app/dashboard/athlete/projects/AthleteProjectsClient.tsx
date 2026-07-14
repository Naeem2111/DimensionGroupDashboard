"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClientAvatar } from "@/components/ops/ClientAvatar";
import { MiniMonthCalendar } from "@/components/MiniMonthCalendar";
import { ProjectProgressBar } from "@/components/ProjectProgressBar";
import { asAvatarTextTone } from "@/lib/avatar-text-tone";
import {
  COMPLEXITY_LABELS,
  displayProjectStageLabel,
  OPS_PROJECT_STAGE_OPTIONS,
  PROJECT_STATUS_LABELS,
  projectStageSelectValue,
} from "@/lib/ops-constants";
import type { OpsProjectPhase } from "@prisma/client";
import { formatProjectFullTitle } from "@/lib/project-display";
import { clientMetaFromNestedClient, groupProjectsByClient } from "@/lib/ops-project-groups";
import { daysUntilDueFromIso, projectDueColor } from "@/lib/project-color-scale";
import { computeProjectTimeline } from "@/lib/project-timeline";

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
  displayTitle?: string;
  stageLabel?: string;
  projectNumber: string;
  address: string | null;
  complexity: keyof typeof COMPLEXITY_LABELS;
  currentStage: OpsProjectPhase;
  currentStatus: keyof typeof PROJECT_STATUS_LABELS;
  startDate: string | null;
  dueDate: string | null;
  handoverDate: string | null;
  progressPercent: number | null;
  notes: string | null;
  client: ProjectClient;
};

export function AthleteProjectsClient() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ currentStage: "", currentStatus: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [clientFilterId, setClientFilterId] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/athlete/projects");
    const j = await r.json();
    if (r.ok) setProjects(j.projects || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dueMarks = useMemo(
    () =>
      projects
        .filter((p) => p.dueDate && (!clientFilterId || p.client.id === clientFilterId))
        .map((p) => {
          const days = daysUntilDueFromIso(p.dueDate);
          return {
            date: p.dueDate!,
            label: `${p.name} due`,
            color: projectDueColor(days),
          };
        }),
    [projects, clientFilterId]
  );

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

  function startEdit(p: ProjectRow) {
    setEditingId(p.id);
    setForm({
      currentStage: p.currentStage,
      currentStatus: p.currentStatus,
      notes: p.notes ?? "",
    });
    setError("");
    setMsg("");
  }

  async function saveEdit(projectId: string) {
    setSaving(true);
    setError("");
    setMsg("");
    const r = await fetch(`/api/athlete/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const j = await r.json();
    setSaving(false);
    if (!r.ok) {
      setError(j.error || "Could not save");
      return;
    }
    setEditingId(null);
    setMsg("Project updated.");
    void load();
  }

  if (loading) return <p className="text-sm text-slate-500">Loading projects…</p>;

  return (
    <div className="space-y-6">
      <div className="card-tool rounded-xl p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-sm font-semibold text-white">Project due dates</h2>
          <label className="text-xs text-slate-400">
            Month
            <input
              type="month"
              value={calendarMonth}
              onChange={(e) => setCalendarMonth(e.target.value)}
              className="mt-1 block rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            />
          </label>
        </div>
        <MiniMonthCalendar className="mt-4" month={calendarMonth} marks={dueMarks} />
        <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#22c55e" }} /> 14+ days
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#3b82f6" }} /> 8–14 days
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#eab308" }} /> 4–7 days
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#f97316" }} /> 1–3 days
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#ef4444" }} /> Overdue
          </span>
        </div>
      </div>

    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <p className="pb-2 text-sm text-slate-400">
          {filteredProjects.length} project{filteredProjects.length === 1 ? "" : "s"}
          {clientFilterId
            ? ` for ${selectedFilterClient?.name ?? "client"}`
            : clientOptions.length > 0
              ? ` · ${projectsByClient.length} client${projectsByClient.length === 1 ? "" : "s"}`
              : ""}
        </p>
        {clientOptions.length > 0 ? (
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
        ) : null}
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
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
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
          {group.projects.map((p) => {
        const timeline = computeProjectTimeline({
          startDate: p.startDate,
          dueDate: p.dueDate,
          handoverDate: p.handoverDate,
        });
        const daysUntil = daysUntilDueFromIso(p.dueDate);
        const accent = projectDueColor(daysUntil);
        return (
        <article
          key={p.id}
          className="card-tool rounded-xl p-5"
          style={{ borderLeftWidth: 4, borderLeftColor: accent }}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold text-white">
                {p.displayTitle ?? formatProjectFullTitle(p.name, p.currentStage)}
              </h2>
              <p className="text-xs text-slate-500">{p.projectNumber}</p>
              <p
                className={`mt-2 text-xs ${
                  timeline.isOverdue
                    ? "text-red-300"
                    : timeline.isDueSoon
                      ? "text-amber-300"
                      : "text-slate-500"
                }`}
              >
                {timeline.daysActive != null ? `${timeline.daysActive} days active · ` : ""}
                {timeline.label}
              </p>
              <div className="mt-3 max-w-md">
                <ProjectProgressBar percent={p.progressPercent ?? 0} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-white/[0.06] px-2 py-1 text-[10px] uppercase text-slate-400">
                {COMPLEXITY_LABELS[p.complexity]}
              </span>
              {editingId !== p.id ? (
                <button
                  type="button"
                  onClick={() => startEdit(p)}
                  className="text-xs text-brand-300 hover:text-brand-200"
                >
                  Edit
                </button>
              ) : null}
            </div>
          </div>
          {p.address ? <p className="mt-2 text-sm text-slate-400">{p.address}</p> : null}

          {editingId === p.id ? (
            <div className="mt-4 grid gap-3 border-t border-white/[0.06] pt-4 md:grid-cols-2">
              <label className="text-xs text-slate-400">
                Stage
                <select
                  value={projectStageSelectValue(form.currentStage as OpsProjectPhase)}
                  onChange={(e) => setForm((f) => ({ ...f, currentStage: e.target.value }))}
                  className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
                >
                  {OPS_PROJECT_STAGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-400">
                Status
                <select
                  value={form.currentStatus}
                  onChange={(e) => setForm((f) => ({ ...f, currentStatus: e.target.value }))}
                  className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
                >
                  {Object.entries(PROJECT_STATUS_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-400 md:col-span-2">
                Notes
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                />
              </label>
              <div className="flex gap-2 md:col-span-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveEdit(p.id)}
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-brand-500 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                <div>
                  <dt className="text-slate-500">Stage</dt>
                  <dd className="text-slate-200">{displayProjectStageLabel(p.currentStage)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Status</dt>
                  <dd className="text-slate-200">{PROJECT_STATUS_LABELS[p.currentStatus]}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Due</dt>
                  <dd className="text-slate-200">{p.dueDate ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Handover</dt>
                  <dd className="text-slate-200">{p.handoverDate ?? "—"}</dd>
                </div>
              </dl>
              {p.notes ? (
                <p className="mt-3 text-sm text-slate-400">
                  <span className="text-slate-500">Notes: </span>
                  {p.notes}
                </p>
              ) : null}
            </>
          )}
        </article>
        );
      })}
        </section>
      ))}
      {filteredProjects.length === 0 ? (
        <p className="text-sm text-slate-500">
          {clientFilterId
            ? "No projects for this client."
            : "No projects assigned yet. Ask your admin to assign projects to you."}
        </p>
      ) : null}
    </div>
    </div>
  );
}
