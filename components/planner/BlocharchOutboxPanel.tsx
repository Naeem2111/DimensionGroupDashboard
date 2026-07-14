"use client";

import { useCallback, useEffect, useState } from "react";
import { APPROVED_PLANNER_LABELS, labelColor } from "@/lib/planner-approved-labels";
import { PlannerLabelChip } from "@/components/planner/PlannerLabelChip";
import { ClientAvatar } from "@/components/ops/ClientAvatar";

type AthleteOption = {
  id: string;
  fullName: string;
  athleteCode: string;
  profilePhotoUrl: string | null;
};
type ProjectOption = { id: string; name: string; clientName: string; assignedAthleteId: string | null };
type OutboxRow = {
  id: string;
  athleteName: string;
  projectName: string | null;
  title: string | null;
  labelName: string | null;
  deliveredAt: string | null;
  createdAt: string;
};

const emptyForm = {
  athleteId: "",
  projectId: "",
  title: "",
  description: "",
  dueAt: "",
  labelName: APPROVED_PLANNER_LABELS[0].name as string,
  notes: "",
};

export function BlocharchOutboxPanel() {
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [history, setHistory] = useState<OutboxRow[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    const r = await fetch("/api/planner/outbox?limit=30");
    const j = await r.json().catch(() => ({}));
    if (r.ok) setHistory(j.tasks || []);
  }, []);

  useEffect(() => {
    Promise.all([fetch("/api/planner/outbox/options").then((r) => r.json()), loadHistory()]).then(
      ([opts]) => {
        if (opts.athletes) {
          setAthletes(
            opts.athletes.map(
              (x: {
                id: string;
                fullName: string;
                athleteCode: string;
                profilePhotoUrl: string | null;
              }) => ({
                id: x.id,
                fullName: x.fullName,
                athleteCode: x.athleteCode,
                profilePhotoUrl: x.profilePhotoUrl,
              })
            )
          );
        }
        if (opts.projects) {
          setProjects(
            opts.projects.map(
              (x: {
                id: string;
                name: string;
                clientName: string;
                assignedAthleteId: string | null;
              }) => ({
                id: x.id,
                name: x.name,
                clientName: x.clientName,
                assignedAthleteId: x.assignedAthleteId,
              })
            )
          );
        }
      }
    );
  }, [loadHistory]);

  const projectOptions = form.athleteId
    ? projects.filter((p) => p.assignedAthleteId === form.athleteId)
    : projects;

  const selectedAthlete = athletes.find((a) => a.id === form.athleteId) ?? null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!form.athleteId) {
      setError("Select an athlete");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/planner/outbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athleteId: form.athleteId,
          projectId: form.projectId || null,
          title: form.title || null,
          description: form.description || null,
          dueAt: form.dueAt || null,
          labelName: form.labelName,
          notes: form.notes || null,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError((j as { error?: string }).error || "Could not assign task");
        return;
      }
      const athleteName = athletes.find((a) => a.id === form.athleteId)?.fullName ?? "athlete";
      setSuccess(`Assigned to ${athleteName} — card added to their Blocharch Inbox.`);
      setForm({ ...emptyForm, athleteId: form.athleteId });
      await loadHistory();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card-tool space-y-6 rounded-xl p-5 ring-1 ring-amber-500/20">
      <div>
        <h2 className="text-lg font-semibold text-amber-100">Blocharch Outbox</h2>
        <p className="mt-1 text-sm text-slate-400">
          Assign work to an athlete. Each assignment creates a card on their{" "}
          <span className="text-slate-300">Blocharch Inbox</span> automatically.
        </p>
      </div>

      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs text-slate-400 sm:col-span-2">
          Athlete <span className="text-red-400">*</span>
          <div className="mt-1 flex items-center gap-2">
            {selectedAthlete ? (
              <ClientAvatar
                name={selectedAthlete.fullName}
                logoUrl={selectedAthlete.profilePhotoUrl}
                objectFit="cover"
                size={32}
              />
            ) : null}
            <select
              required
              value={form.athleteId}
              onChange={(e) => setForm((f) => ({ ...f, athleteId: e.target.value, projectId: "" }))}
              className="select-console block min-w-0 flex-1 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Select athlete…</option>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.fullName} ({a.athleteCode})
                </option>
              ))}
            </select>
          </div>
        </label>

        <label className="text-xs text-slate-400">
          Project (optional)
          <select
            value={form.projectId}
            onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
            className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
          >
            <option value="">None</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.clientName}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-slate-400">
          Label
          <select
            value={form.labelName}
            onChange={(e) => setForm((f) => ({ ...f, labelName: e.target.value }))}
            className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
          >
            {APPROVED_PLANNER_LABELS.map((l) => (
              <option key={l.name} value={l.name}>
                {l.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-slate-400 sm:col-span-2">
          Task title (optional)
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            placeholder="e.g. Update GA drawings"
          />
        </label>

        <label className="text-xs text-slate-400 sm:col-span-2">
          Description (optional)
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
            className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
          />
        </label>

        <label className="text-xs text-slate-400">
          Due date (optional)
          <input
            type="date"
            value={form.dueAt}
            onChange={(e) => setForm((f) => ({ ...f, dueAt: e.target.value }))}
            className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
          />
        </label>

        <label className="text-xs text-slate-400 sm:col-span-2">
          Notes (optional)
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={2}
            className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
          />
        </label>

        {error ? <p className="text-sm text-red-400 sm:col-span-2">{error}</p> : null}
        {success ? <p className="text-sm text-brand-300 sm:col-span-2">{success}</p> : null}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-500 disabled:opacity-50"
          >
            {saving ? "Assigning…" : "Assign to athlete"}
          </button>
        </div>
      </form>

      {history.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent assignments</h3>
          <ul className="mt-2 divide-y divide-white/[0.06] rounded-lg border border-white/[0.06]">
            {history.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="text-slate-300">
                  {row.title || "Task"} → {row.athleteName}
                  {row.projectName ? ` (${row.projectName})` : ""}
                </span>
                <span className="text-xs text-slate-500">
                  {row.labelName ? (
                    <PlannerLabelChip
                      name={row.labelName}
                      color={labelColor(row.labelName)}
                      className="mr-2"
                    />
                  ) : null}
                  {row.deliveredAt ? "Delivered" : "Pending"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
