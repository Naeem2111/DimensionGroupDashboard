"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { OpsProjectPhase } from "@prisma/client";
import { ClientAvatar } from "@/components/ops/ClientAvatar";
import { ProjectProgressBar } from "@/components/ProjectProgressBar";
import { asAvatarTextTone } from "@/lib/avatar-text-tone";
import {
  COMPLEXITY_LABELS,
  displayProjectStageLabel,
  OPS_PROJECT_STAGE_OPTIONS,
  PROJECT_STATUS_LABELS,
  projectStageSelectValue,
} from "@/lib/ops-constants";
import { daysUntilDueFromIso, projectDueColor } from "@/lib/project-color-scale";
import { computeProjectTimeline } from "@/lib/project-timeline";
import { formatProjectFullTitle } from "@/lib/project-display";

type ClientContactOption = { id: string; name: string; email: string | null };

type ClientOption = {
  id: string;
  name: string;
  logoUrl: string | null;
  logoBgColor: string | null;
  logoTextTone: string | null;
  contacts: ClientContactOption[];
};
type AthleteOption = { id: string; fullName: string; athleteCode: string };
type ProjectRow = {
  id: string;
  clientId: string;
  clientName: string;
  clientLogoUrl: string | null;
  clientLogoBgColor: string | null;
  clientLogoTextTone: string | null;
  assignedAthleteId: string | null;
  assignedAthleteName: string | null;
  projectLeadContactId: string | null;
  projectLeadContactName: string | null;
  projectLeadContactEmail: string | null;
  athleteCode: string | null;
  name: string;
  displayTitle?: string;
  projectNumber: string;
  address: string | null;
  projectLead: string | null;
  complexity: keyof typeof COMPLEXITY_LABELS;
  currentStage: OpsProjectPhase;
  currentStatus: keyof typeof PROJECT_STATUS_LABELS;
  startDate: string | null;
  dueDate: string | null;
  handoverDate: string | null;
  notes: string | null;
  progressPercent: number | null;
};

const emptyCreate = {
  clientId: "",
  assignedAthleteId: "",
  name: "",
  projectNumber: "",
  address: "",
  projectLeadContactId: "",
  currentStage: "survey_conversion",
  complexity: "medium",
  dueDate: "",
};

const inputClass =
  "mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white";

export function OpsProjectsClient() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editClientId, setEditClientId] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState(emptyCreate);
  const [clientFilterId, setClientFilterId] = useState("");
  const [scope, setScope] = useState<"active" | "all">("active");
  const [editForm, setEditForm] = useState({
    assignedAthleteId: "",
    projectLeadContactId: "",
    name: "",
    projectNumber: "",
    address: "",
    complexity: "medium",
    currentStage: "survey_conversion",
    currentStatus: "not_started",
    startDate: "",
    dueDate: "",
    handoverDate: "",
    notes: "",
  });

  const load = useCallback(async () => {
    const [pr, cr, ar] = await Promise.all([
      fetch(`/api/ops/projects?scope=${scope}`),
      fetch("/api/ops/clients"),
      fetch("/api/ops/athletes"),
    ]);
    const pj = await pr.json();
    const cj = await cr.json();
    const aj = await ar.json();
    if (pr.ok) setProjects(pj.projects || []);
    if (cr.ok)
      setClients(
        (cj.clients || []).map(
          (c: {
            id: string;
            name: string;
            logoUrl?: string | null;
            logoBgColor?: string | null;
            logoTextTone?: string | null;
            contacts?: { id: string; name: string; email: string | null }[];
          }) => ({
            id: c.id,
            name: c.name,
            logoUrl: c.logoUrl ?? null,
            logoBgColor: c.logoBgColor ?? null,
            logoTextTone: c.logoTextTone ?? null,
            contacts: (c.contacts ?? []).map((ct) => ({
              id: ct.id,
              name: ct.name,
              email: ct.email ?? null,
            })),
          })
        )
      );
    if (ar.ok)
      setAthletes(
        (aj.athletes || []).map((a: { id: string; fullName: string; athleteCode: string }) => ({
          id: a.id,
          fullName: a.fullName,
          athleteCode: a.athleteCode,
        }))
      );
    setLoading(false);
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const r = await fetch("/api/ops/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        assignedAthleteId: form.assignedAthleteId || null,
        projectLeadContactId: form.projectLeadContactId || null,
        dueDate: form.dueDate || null,
      }),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Could not create project");
      return;
    }
    setOpen(false);
    setForm(emptyCreate);
    await load();
  }

  function startEdit(p: ProjectRow) {
    const athleteId = p.assignedAthleteId ?? "";
    setEditingId(p.id);
    setEditClientId(p.clientId);
    setEditForm({
      assignedAthleteId: athleteId,
      projectLeadContactId: p.projectLeadContactId ?? "",
      name: p.name,
      projectNumber: p.projectNumber,
      address: p.address ?? "",
      complexity: p.complexity,
      currentStage: p.currentStage,
      currentStatus: p.currentStatus,
      startDate: p.startDate ?? "",
      dueDate: p.dueDate ?? "",
      handoverDate: p.handoverDate ?? "",
      notes: p.notes ?? "",
    });
    setError("");
    setMsg("");
  }

  async function saveEdit(id: string) {
    setError("");
    const r = await fetch(`/api/ops/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignedAthleteId: editForm.assignedAthleteId || null,
        projectLeadContactId: editForm.projectLeadContactId || null,
        name: editForm.name,
        projectNumber: editForm.projectNumber,
        address: editForm.address,
        complexity: editForm.complexity,
        currentStage: editForm.currentStage,
        currentStatus: editForm.currentStatus,
        startDate: editForm.startDate || null,
        dueDate: editForm.dueDate || null,
        handoverDate: editForm.handoverDate || null,
        notes: editForm.notes || null,
      }),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Could not save");
      return;
    }
    setEditingId(null);
    setEditClientId("");
    setMsg("Project updated.");
    await load();
  }

  async function deleteProject(id: string, name: string) {
    if (!window.confirm(`Delete project "${name}"? This cannot be undone.`)) return;
    setError("");
    const r = await fetch(`/api/ops/projects/${id}`, { method: "DELETE" });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Could not delete");
      return;
    }
    setEditingId(null);
    setMsg("Project deleted.");
    await load();
  }

  const filteredProjects = useMemo(() => {
    if (!clientFilterId) return projects;
    return projects.filter((p) => p.clientId === clientFilterId);
  }, [projects, clientFilterId]);

  const projectsByClient = useMemo(() => {
    const groups = new Map<
      string,
      {
        clientId: string;
        clientName: string;
        clientLogoUrl: string | null;
        clientLogoBgColor: string | null;
        clientLogoTextTone: string | null;
        projects: ProjectRow[];
      }
    >();
    for (const p of filteredProjects) {
      const existing = groups.get(p.clientId);
      if (existing) {
        existing.projects.push(p);
      } else {
        groups.set(p.clientId, {
          clientId: p.clientId,
          clientName: p.clientName,
          clientLogoUrl: p.clientLogoUrl,
          clientLogoBgColor: p.clientLogoBgColor,
          clientLogoTextTone: p.clientLogoTextTone,
          projects: [p],
        });
      }
    }
    return Array.from(groups.values()).sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [filteredProjects]);

  if (loading) return <p className="text-sm text-slate-500">Loading projects…</p>;

  const createClient = clients.find((c) => c.id === form.clientId) ?? null;
  const createClientContacts = createClient?.contacts ?? [];
  const editClient = clients.find((c) => c.id === editClientId) ?? null;
  const editClientContacts = editClient?.contacts ?? [];
  const selectedFilterClient = clients.find((c) => c.id === clientFilterId) ?? null;

  function athleteCodeById(athleteId: string): string {
    return athletes.find((a) => a.id === athleteId)?.athleteCode ?? "";
  }

  function handleCreateAthleteChange(athleteId: string) {
    setForm((f) => ({
      ...f,
      assignedAthleteId: athleteId,
      projectNumber: f.projectNumber || (athleteId ? athleteCodeById(athleteId) : ""),
    }));
  }

  function handleEditAthleteChange(athleteId: string) {
    setEditForm((f) => ({
      ...f,
      assignedAthleteId: athleteId,
    }));
  }

  function renderProjectCard(p: ProjectRow) {
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
        className="card-tool rounded-xl p-4"
        style={{ borderLeftWidth: 4, borderLeftColor: accent }}
      >
        {editingId === p.id ? (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs text-slate-400">Name<input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white" /></label>
            <label className="text-xs text-slate-400">
              Assigned athlete
              <select
                value={editForm.assignedAthleteId}
                onChange={(e) => handleEditAthleteChange(e.target.value)}
                className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
              >
                <option value="">Unassigned</option>
                {athletes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-400">
              Office lead
              <select
                value={editForm.projectLeadContactId}
                onChange={(e) => setEditForm((f) => ({ ...f, projectLeadContactId: e.target.value }))}
                className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
              >
                <option value="">None (hidden on client portal)</option>
                {editClientContacts.map((ct) => (
                  <option key={ct.id} value={ct.id}>
                    {ct.name}
                    {ct.email ? ` · ${ct.email}` : ""}
                  </option>
                ))}
              </select>
              {editClientContacts.length === 0 ? (
                <span className="mt-1 block text-[10px] text-amber-400">
                  Add office leads on the client record first (Ops → Clients).
                </span>
              ) : (
                <span className="mt-1 block text-[10px] text-slate-500">Shown to clients on the project portal</span>
              )}
            </label>
            <label className="text-xs text-slate-400">
              Athlete code
              <input
                value={editForm.projectNumber}
                onChange={(e) => setEditForm((f) => ({ ...f, projectNumber: e.target.value }))}
                placeholder="Can repeat across projects — same client/address allowed"
                className={inputClass}
              />
            </label>
            <label className="text-xs text-slate-400 md:col-span-2">
              Address
              <input
                value={editForm.address}
                onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                className={inputClass}
              />
            </label>
            <label className="text-xs text-slate-400">Complexity<select value={editForm.complexity} onChange={(e) => setEditForm((f) => ({ ...f, complexity: e.target.value }))} className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
            <label className="text-xs text-slate-400">
              Stage / package
              <select
                value={projectStageSelectValue(editForm.currentStage as OpsProjectPhase)}
                onChange={(e) => setEditForm((f) => ({ ...f, currentStage: e.target.value }))}
                className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
              >
                {OPS_PROJECT_STAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-400">Status<select value={editForm.currentStatus} onChange={(e) => setEditForm((f) => ({ ...f, currentStatus: e.target.value }))} className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm">{Object.entries(PROJECT_STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label className="text-xs text-slate-400">Due<input type="date" value={editForm.dueDate} onChange={(e) => setEditForm((f) => ({ ...f, dueDate: e.target.value }))} className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white" /></label>
            <label className="text-xs text-slate-400">Handover<input type="date" value={editForm.handoverDate} onChange={(e) => setEditForm((f) => ({ ...f, handoverDate: e.target.value }))} className="mt-1 block w-full rounded-md border border-white/[0.04] px-3 py-2 text-sm text-white" /></label>
            <label className="text-xs text-slate-400 md:col-span-2">Notes<textarea value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white" /></label>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <button
                type="button"
                onClick={() => void saveEdit(p.id)}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-slate-950"
              >
                Save
              </button>
              <button type="button" onClick={() => { setEditingId(null); setEditClientId(""); }} className="text-xs text-slate-500">Cancel</button>
              <button type="button" onClick={() => void deleteProject(p.id, p.name)} className="text-xs text-red-400 hover:text-red-300">Delete project</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-semibold text-white">
                {p.displayTitle ?? formatProjectFullTitle(p.name, p.currentStage)}
              </h2>
              <p className="text-xs text-slate-500">
                ID {p.id.slice(0, 8)} · {p.projectNumber}
                {p.address ? ` · ${p.address}` : ""}
                {p.assignedAthleteName ? ` · ${p.assignedAthleteName}` : " · Unassigned"}
              </p>
              {p.projectLeadContactName ? (
                <p className="text-xs text-slate-400">
                  Office lead: {p.projectLeadContactName}
                  {p.projectLeadContactEmail ? ` · ${p.projectLeadContactEmail}` : ""}
                </p>
              ) : null}
              <p
                className={`mt-2 text-xs ${
                  timeline.isOverdue
                    ? "text-red-300"
                    : timeline.isDueSoon
                      ? "text-amber-300"
                      : "text-slate-500"
                }`}
              >
                {displayProjectStageLabel(p.currentStage)} · {PROJECT_STATUS_LABELS[p.currentStatus]}
                {timeline.daysActive != null ? ` · ${timeline.daysActive} days active` : ""}
                {timeline.label ? ` · ${timeline.label}` : ""}
              </p>
              <div className="mt-3 max-w-md">
                <ProjectProgressBar percent={p.progressPercent ?? 0} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-white/[0.06] px-2 py-1 text-[10px] uppercase text-slate-400">
                {COMPLEXITY_LABELS[p.complexity]}
              </span>
              <button type="button" onClick={() => startEdit(p)} className="text-xs text-brand-300 hover:text-brand-200">Edit</button>
            </div>
          </div>
        )}
      </article>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-4">
          <p className="pb-2 text-sm text-slate-400">
            {filteredProjects.length} project{filteredProjects.length === 1 ? "" : "s"}
            {clientFilterId
              ? ` for ${selectedFilterClient?.name ?? "client"}`
              : ` · ${projectsByClient.length} client${projectsByClient.length === 1 ? "" : "s"}`}
          </p>
          <label className="text-xs text-slate-400 pb-2">
            View
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as "active" | "all")}
              className="select-console mt-1 block min-w-[10rem] rounded-md px-3 py-2 text-sm"
            >
              <option value="active">Active only</option>
              <option value="all">All (incl. completed)</option>
            </select>
          </label>
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
        <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand-500">
          New project
        </button>
      </div>
      {msg ? <p className="text-sm text-brand-300">{msg}</p> : null}

      {open && (
        <form onSubmit={createProject} className="card-tool grid gap-3 rounded-xl p-4 md:grid-cols-2">
          <label className="text-xs text-slate-400">
            Client
            <div className="mt-1 flex items-center gap-2">
              {createClient ? (
                <ClientAvatar
                  name={createClient.name}
                  logoUrl={createClient.logoUrl}
                  backgroundColor={createClient.logoBgColor}
                  textTone={asAvatarTextTone(createClient.logoTextTone)}
                  size={28}
                />
              ) : null}
              <select
                required
                value={form.clientId}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    clientId: e.target.value,
                    projectLeadContactId: "",
                  }))
                }
                className="select-console block min-w-0 flex-1 rounded-md px-3 py-2 text-sm"
              >
                <option value="">Select…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </label>
          <label className="text-xs text-slate-400">
            Assigned athlete
            <select
              required
              value={form.assignedAthleteId}
              onChange={(e) => handleCreateAthleteChange(e.target.value)}
              className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
            >
              <option value="">Select…</option>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            Office lead
            <select
              value={form.projectLeadContactId}
              onChange={(e) => setForm((f) => ({ ...f, projectLeadContactId: e.target.value }))}
              className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
              disabled={!form.clientId}
            >
              <option value="">
                {form.clientId ? "None (hidden on client portal)" : "Select client first"}
              </option>
              {createClientContacts.map((ct) => (
                <option key={ct.id} value={ct.id}>
                  {ct.name}
                  {ct.email ? ` · ${ct.email}` : ""}
                </option>
              ))}
            </select>
            {form.clientId && createClientContacts.length === 0 ? (
              <span className="mt-1 block text-[10px] text-amber-400">
                Add office leads on the client record first (Ops → Clients).
              </span>
            ) : (
              <span className="mt-1 block text-[10px] text-slate-500">Pick from this client&apos;s office leads</span>
            )}
          </label>
          <label className="text-xs text-slate-400">
            Stage / package
            <select
              required
              value={form.currentStage}
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
          <label className="text-xs text-slate-400">Project title<input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. 86 Bishops Road" className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white" /></label>
          <label className="text-xs text-slate-400">
            Athlete code
            <input
              value={form.projectNumber}
              onChange={(e) => setForm((f) => ({ ...f, projectNumber: e.target.value }))}
              placeholder="Defaults from athlete — can repeat per client"
              className={inputClass}
            />
          </label>
          <label className="text-xs text-slate-400 md:col-span-2">Address<input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white" /></label>
          <label className="text-xs text-slate-400">Due<input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white" /></label>
          {form.name || form.address ? (
            <p className="text-xs text-slate-500 md:col-span-2">
              Full title preview:{" "}
              {formatProjectFullTitle(
                form.name || form.address,
                form.currentStage as OpsProjectPhase
              )}
            </p>
          ) : null}
          {error ? <p className="text-sm text-red-400 md:col-span-2">{error}</p> : null}
          <div className="flex gap-2 md:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-white/[0.08] px-4 py-2 text-sm text-slate-100"
            >
              Create
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500">Cancel</button>
          </div>
        </form>
      )}

      <div className="space-y-8">
        {projectsByClient.map((group) => (
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
                  {group.projects.length} project{group.projects.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <div className="space-y-3">{group.projects.map((p) => renderProjectCard(p))}</div>
          </section>
        ))}
        {filteredProjects.length === 0 ? (
          <p className="text-sm text-slate-500">
            {clientFilterId ? "No projects for this client." : "No projects yet."}
          </p>
        ) : null}
      </div>
      {error && !open ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
