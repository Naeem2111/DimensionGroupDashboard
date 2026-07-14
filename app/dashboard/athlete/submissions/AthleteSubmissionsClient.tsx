"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MiniMonthCalendar } from "@/components/MiniMonthCalendar";
import { ProgressSlider } from "@/components/ProgressSlider";
import { CheckInRequestModal } from "@/components/athlete/CheckInRequestModal";
import { DAILY_PROJECT_PHASE_OPTIONS, DAILY_TASK_TYPE_OPTIONS } from "@/lib/ops-daily-form";

type AssignedProject = {
  id: string;
  name: string;
  displayTitle?: string;
  projectNumber: string;
  complexity: string;
  client: { id: string; name: string };
};

type LineItemForm = {
  key: string;
  isHousekeeping: boolean;
  clientId: string;
  projectId: string;
  projectPhase: string;
  taskTypes: string[];
  taskTypeOther: string;
  hoursWorked: string;
  completionPercent: number;
  completedSummary: string;
  housekeepingNote: string;
};

type CalcPanel = {
  todayHours: number;
  monthHoursAfter: number;
  hoursRemaining: number;
  overtimeTriggered: boolean;
  overtimeHours: number;
  totalEarningsZar: number;
  alerts?: Array<{ code: string; severity: string; message: string }>;
};

type PastSubmission = {
  id: string;
  submissionDate: string;
  totalHours: number;
  wellbeingScore: number | null;
  checkInRequested: boolean;
  dailyNote: string | null;
  isBackloggedSession?: boolean;
  lockedAt: string | null;
  editable: boolean;
  alerts: Array<{ code: string; severity: string; message: string }>;
  lineItems: Array<{
    id: string;
    projectId: string | null;
    clientId?: string;
    clientName: string;
    projectName: string;
    projectNumber: string;
    isHousekeeping?: boolean;
    projectPhase: string;
    taskType: string;
    taskTypes?: string[];
    hoursWorked: number;
    completedSummary: string | null;
    completionPercent?: number | null;
    notes?: string | null;
  }>;
};

function emptyLine(): LineItemForm {
  return {
    key: crypto.randomUUID(),
    isHousekeeping: false,
    clientId: "",
    projectId: "",
    projectPhase: "survey_conversion",
    taskTypes: ["plans"],
    taskTypeOther: "",
    hoursWorked: "",
    completionPercent: 0,
    completedSummary: "",
    housekeepingNote: "",
  };
}

function emptyHousekeepingLine(): LineItemForm {
  return {
    key: crypto.randomUUID(),
    isHousekeeping: true,
    clientId: "",
    projectId: "",
    projectPhase: "housekeeping_internal",
    taskTypes: ["admin_housekeeping"],
    taskTypeOther: "",
    hoursWorked: "",
    completionPercent: 0,
    completedSummary: "",
    housekeepingNote: "",
  };
}

export function AthleteSubmissionsClient() {
  const [projects, setProjects] = useState<AssignedProject[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [pastSubmissions, setPastSubmissions] = useState<PastSubmission[]>([]);
  const [monthlyHourCap, setMonthlyHourCap] = useState(160);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [calc, setCalc] = useState<CalcPanel | null>(null);
  const [wellbeingScore, setWellbeingScore] = useState("5");
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [checkInDetailsSubmitted, setCheckInDetailsSubmitted] = useState(false);
  const [dailyNote, setDailyNote] = useState("");
  const [isBackloggedSession, setIsBackloggedSession] = useState(false);
  const [lines, setLines] = useState<LineItemForm[]>([emptyLine()]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [formLocked, setFormLocked] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedSubmissionIds, setExpandedSubmissionIds] = useState<Set<string>>(new Set());
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  function applySubmission(sub: PastSubmission, notify?: string) {
    setEditingId(sub.id);
    setSelectedDate(sub.submissionDate);
    setCalendarMonth(sub.submissionDate.slice(0, 7));
    setWellbeingScore(String(sub.wellbeingScore ?? 5));
    setDailyNote(sub.dailyNote ?? "");
    setIsBackloggedSession(!!sub.isBackloggedSession);
    setCheckInDetailsSubmitted(!!sub.checkInRequested);
    setFormLocked(!sub.editable);
    setLines(
      sub.lineItems.length > 0
        ? sub.lineItems.map((li) => ({
            key: crypto.randomUUID(),
            isHousekeeping: !!li.isHousekeeping,
            clientId: li.isHousekeeping ? (li.clientId ?? "") : "",
            projectId: li.projectId ?? "",
            projectPhase: li.projectPhase,
            taskTypes:
              li.taskTypes && li.taskTypes.length > 0
                ? li.taskTypes
                : li.taskType
                  ? [li.taskType]
                  : li.isHousekeeping
                    ? ["admin_housekeeping"]
                    : ["plans"],
            hoursWorked: String(li.hoursWorked),
            completionPercent: li.completionPercent ?? 0,
            completedSummary: li.completedSummary ?? "",
            taskTypeOther:
              li.taskTypes?.includes("other") && li.notes ? String(li.notes) : "",
            housekeepingNote: li.isHousekeeping && li.notes ? String(li.notes) : "",
          }))
        : [emptyLine()]
    );
    if (notify) setSuccess(notify);
  }

  function loadSubmissionIntoForm(sub: PastSubmission) {
    if (!sub.editable) {
      setError("This submission is locked. Ask admin to unlock it under Commercial → Submission locks.");
      return;
    }
    setError("");
    applySubmission(sub, `Editing ${sub.submissionDate}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetToToday() {
    setEditingId(null);
    setSelectedDate(today);
    setCalendarMonth(today.slice(0, 7));
    setWellbeingScore("5");
    setDailyNote("");
    setIsBackloggedSession(false);
    setCheckInDetailsSubmitted(false);
    setLines([emptyLine()]);
    setFormLocked(false);
    setError("");
    setSuccess("");
  }

  const load = useCallback(async () => {
    const [pr, sr] = await Promise.all([fetch("/api/athlete/projects"), fetch("/api/athlete/submissions")]);
    const pj = await pr.json();
    const sj = await sr.json();
    if (pr.ok) {
      setProjects(pj.projects || []);
      setClients(pj.clients || []);
    }
    if (sr.ok) {
      const subs: PastSubmission[] = sj.submissions || [];
      setPastSubmissions(subs);
      if (sj.monthlyHourCap) setMonthlyHourCap(sj.monthlyHourCap);
      const todaySub = subs.find((s) => s.submissionDate === today);
      if (todaySub?.editable) applySubmission(todaySub);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submissionMarks = useMemo(
    () =>
      pastSubmissions.map((s) => ({
        date: s.submissionDate,
        label: `${s.totalHours}h logged`,
        color: s.lockedAt ? "#64748b" : "#3b82f6",
      })),
    [pastSubmissions]
  );

  function onPickDate(date: string) {
    setSelectedDate(date);
    setCalendarMonth(date.slice(0, 7));
    const sub = pastSubmissions.find((s) => s.submissionDate === date);
    if (sub?.editable) {
      applySubmission(sub);
      return;
    }
    if (sub && !sub.editable) {
      setError("This submission is locked. Ask admin to unlock it under Commercial.");
      setFormLocked(true);
      applySubmission(sub);
      return;
    }
    setEditingId(null);
    setFormLocked(false);
    setWellbeingScore("5");
    setDailyNote("");
    setIsBackloggedSession(false);
    setCheckInDetailsSubmitted(false);
    setLines([emptyLine()]);
    setError("");
  }

  const todayHoursPreview = lines.reduce((sum, li) => sum + (Number(li.hoursWorked) || 0), 0);

  function updateLine(key: string, patch: Partial<LineItemForm>) {
    setLines((prev) => prev.map((li) => (li.key === key ? { ...li, ...patch } : li)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((li) => li.key !== key)));
  }

  function addHousekeepingLine() {
    setLines((prev) => [...prev, emptyHousekeepingLine()]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const lineItems = lines
        .filter((li) => Number(li.hoursWorked) > 0 && (li.isHousekeeping ? li.clientId : li.projectId))
        .map((li) => {
          if (li.isHousekeeping) {
            if (!li.housekeepingNote.trim()) {
              throw new Error("Add a short note for each housekeeping entry");
            }
            return {
              clientId: li.clientId,
              isHousekeeping: true,
              hoursWorked: Number(li.hoursWorked),
              notes: li.housekeepingNote.trim(),
            };
          }
          const project = projects.find((p) => p.id === li.projectId);
          if (!project) throw new Error("Invalid project");
          const taskTypes = li.taskTypes.length > 0 ? li.taskTypes : ["other"];
          if (taskTypes.includes("other") && !li.taskTypeOther.trim()) {
            throw new Error("Please describe the “Other” task type for each entry that uses it");
          }
          return {
            clientId: project.client.id,
            projectId: li.projectId,
            projectPhase: li.projectPhase,
            taskTypes,
            hoursWorked: Number(li.hoursWorked),
            completionPercent: li.completionPercent,
            completedSummary: li.completedSummary || null,
            notes: taskTypes.includes("other") ? li.taskTypeOther.trim() : null,
          };
        });

      if (lineItems.length === 0) {
        setError("Add at least one project or housekeeping entry with hours.");
        return;
      }

      const r = await fetch("/api/athlete/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionDate: selectedDate,
          wellbeingScore: Number(wellbeingScore),
          dailyNote,
          isBackloggedSession,
          checkInRequested: checkInDetailsSubmitted,
          lineItems,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || "Could not save submission");
        return;
      }
      setCalc(j.calculation);
      setSuccess("Daily log saved.");
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  function toggleSubmissionExpanded(id: string) {
    setExpandedSubmissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const pastEntries = useMemo(
    () => pastSubmissions.filter((s) => s.submissionDate !== selectedDate || s.id !== editingId),
    [pastSubmissions, selectedDate, editingId]
  );

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="space-y-8">
    <form onSubmit={submit} className="space-y-6">
      <div className="card-tool grid gap-4 rounded-xl p-4 lg:grid-cols-[1fr,minmax(220px,280px)]">
        <div className="grid gap-4 md:grid-cols-3">
        <label className="text-xs text-slate-400">
          Date
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onPickDate(e.target.value)}
            className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="text-xs text-slate-400">
          Wellbeing (1–10)
          <select
            value={wellbeingScore}
            onChange={(e) => setWellbeingScore(e.target.value)}
            disabled={formLocked}
            className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        </div>
        <div className="border-t border-white/[0.06] pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
          <label className="text-xs text-slate-400">
            Month
            <input
              type="month"
              value={calendarMonth}
              onChange={(e) => setCalendarMonth(e.target.value)}
              className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            />
          </label>
          <MiniMonthCalendar
            className="mt-3"
            month={calendarMonth}
            marks={submissionMarks}
            selectedDate={selectedDate}
            onSelectDate={onPickDate}
          />
          <p className="mt-2 text-[10px] text-slate-600">
            Blue dots = logged days. Tap a day to edit or create an entry.
          </p>
        </div>
      </div>

      <div className="card-tool grid gap-4 rounded-xl p-4 md:grid-cols-3">
        <label className="flex items-center gap-2 text-sm text-slate-300 md:col-span-3">
          <input
            type="checkbox"
            checked={checkInDetailsSubmitted}
            disabled={formLocked}
            onChange={(e) => {
              if (e.target.checked) {
                setCheckInModalOpen(true);
              } else {
                setCheckInDetailsSubmitted(false);
              }
            }}
            className="rounded border-white/20"
          />
          Check-in required
          {checkInDetailsSubmitted ? (
            <span className="text-xs text-brand-300">— details submitted</span>
          ) : null}
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300 md:col-span-3">
          <input
            type="checkbox"
            checked={isBackloggedSession}
            disabled={formLocked}
            onChange={(e) => setIsBackloggedSession(e.target.checked)}
            className="rounded border-white/20"
          />
          Backlogged session
          <span className="text-xs text-slate-500">
            — late entry for a past date; completion and deadline-beaten stats use this session date when progress hits 100%
          </span>
        </label>
        <label className="text-xs text-slate-400 md:col-span-3">
          Daily note (optional)
          <textarea
            value={dailyNote}
            onChange={(e) => setDailyNote(e.target.value)}
            rows={2}
            className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
          />
        </label>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-white">Work entries</h2>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={addLine}
              disabled={projects.length === 0}
              className="text-xs font-medium text-brand-300 hover:text-brand-200 disabled:opacity-40"
            >
              + Add project entry
            </button>
            <button
              type="button"
              onClick={addHousekeepingLine}
              disabled={clients.length === 0}
              className="text-xs font-medium text-slate-300 hover:text-white disabled:opacity-40"
            >
              + Add client housekeeping
            </button>
          </div>
        </div>

        {projects.length === 0 && clients.length === 0 ? (
          <p className="text-sm text-slate-500">No assigned clients yet — you cannot log work.</p>
        ) : null}

        {lines.map((li) => {
          if (li.isHousekeeping) {
            return (
              <div key={li.key} className="card-tool grid gap-3 rounded-xl border border-amber-500/20 p-4 md:grid-cols-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-300/90 md:col-span-2">
                  Client housekeeping
                </p>
                <p className="text-[11px] text-slate-500 md:col-span-2">
                  Internal client work only — not tied to a project and not shown on the client portal.
                </p>
                <label className="text-xs text-slate-400 md:col-span-2">
                  Client
                  <select
                    required
                    value={li.clientId}
                    onChange={(e) => updateLine(li.key, { clientId: e.target.value })}
                    className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">Select client…</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-400">
                  Hours worked
                  <input
                    type="number"
                    min={0.25}
                    step={0.25}
                    required
                    value={li.hoursWorked}
                    disabled={formLocked}
                    onChange={(e) => updateLine(li.key, { hoursWorked: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-slate-400 md:col-span-2">
                  What was done <span className="text-red-400">*</span>
                  <textarea
                    required
                    value={li.housekeepingNote}
                    disabled={formLocked}
                    onChange={(e) => updateLine(li.key, { housekeepingNote: e.target.value })}
                    rows={2}
                    className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                    placeholder="e.g. File tidy, inbox catch-up, admin for Icon Architects"
                  />
                </label>
                {lines.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeLine(li.key)}
                    className="text-xs text-slate-500 hover:text-red-300 md:col-span-2 md:text-left"
                  >
                    Remove entry
                  </button>
                ) : null}
              </div>
            );
          }

          const project = projects.find((p) => p.id === li.projectId);
          return (
            <div key={li.key} className="card-tool grid gap-3 rounded-xl p-4 md:grid-cols-2">
              <label className="text-xs text-slate-400 md:col-span-2">
                Project
                <select
                  required
                  value={li.projectId}
                  onChange={(e) => {
                    const projectId = e.target.value;
                    const p = projects.find((x) => x.id === projectId);
                    updateLine(li.key, {
                      projectId,
                      clientId: p?.client.id ?? "",
                    });
                  }}
                  className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Select project…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.client.name} — {p.displayTitle ?? p.name} ({p.projectNumber})
                    </option>
                  ))}
                </select>
              </label>
              {project ? (
                <p className="text-[11px] text-slate-500 md:col-span-2">Complexity: {project.complexity}</p>
              ) : null}
              <label className="text-xs text-slate-400">
                Project phase
                <select
                  value={li.projectPhase}
                  onChange={(e) => updateLine(li.key, { projectPhase: e.target.value })}
                  className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
                >
                  {DAILY_PROJECT_PHASE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="text-xs text-slate-400 md:col-span-2">
                <p className="mb-2">Task types (select all that apply)</p>
                <div className="flex flex-wrap gap-2">
                  {DAILY_TASK_TYPE_OPTIONS.map((opt) => {
                    const checked = li.taskTypes.includes(opt.value);
                    return (
                      <label
                        key={opt.value}
                        className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 ring-1 ${
                          checked
                            ? "bg-brand-500/15 text-brand-200 ring-brand-500/30"
                            : "bg-white/[0.03] text-slate-400 ring-white/[0.08]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => {
                            const next = checked
                              ? li.taskTypes.filter((t) => t !== opt.value)
                              : [...li.taskTypes, opt.value];
                            updateLine(li.key, {
                              taskTypes: next.length > 0 ? next : [opt.value],
                            });
                          }}
                        />
                        {opt.label}
                      </label>
                    );
                  })}
                </div>
                {li.taskTypes.includes("other") ? (
                  <label className="text-xs text-slate-400 md:col-span-2">
                    Specify “Other” <span className="text-red-400">*</span>
                    <input
                      required
                      value={li.taskTypeOther}
                      disabled={formLocked}
                      onChange={(e) => updateLine(li.key, { taskTypeOther: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                      placeholder="Describe the task type"
                    />
                  </label>
                ) : null}
              </div>
              <label className="text-xs text-slate-400">
                Hours worked
                <input
                  type="number"
                  min={0.25}
                  step={0.25}
                  required
                  value={li.hoursWorked}
                  disabled={formLocked}
                  onChange={(e) => updateLine(li.key, { hoursWorked: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                />
              </label>
              <div className="md:col-span-2">
                <ProgressSlider
                  value={li.completionPercent}
                  onChange={(v) => updateLine(li.key, { completionPercent: v })}
                  disabled={formLocked}
                />
              </div>
              <label className="text-xs text-slate-400 md:col-span-2">
                What was completed
                <textarea
                  value={li.completedSummary}
                  onChange={(e) => updateLine(li.key, { completedSummary: e.target.value })}
                  rows={2}
                  className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                />
              </label>
              {lines.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeLine(li.key)}
                  className="text-xs text-slate-500 hover:text-red-300 md:col-span-2 md:text-left"
                >
                  Remove entry
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="card-tool rounded-xl p-4">
        <h2 className="text-sm font-semibold text-white">Smart calculation</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
          <div>
            <dt className="text-slate-500">Today (preview)</dt>
            <dd className="font-medium text-white">{todayHoursPreview.toFixed(2)}h</dd>
          </div>
          {calc ? (
            <>
              <div>
                <dt className="text-slate-500">Month after save</dt>
                <dd className="font-medium text-white">{calc.monthHoursAfter.toFixed(1)}h</dd>
              </div>
              <div>
                <dt className="text-slate-500">Remaining to {monthlyHourCap}h</dt>
                <dd className="font-medium text-white">{calc.hoursRemaining.toFixed(1)}h</dd>
              </div>
              <div>
                <dt className="text-slate-500">Overtime</dt>
                <dd className="font-medium text-amber-300">
                  {calc.overtimeTriggered ? `${calc.overtimeHours.toFixed(1)}h` : "No"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Est. monthly earnings</dt>
                <dd className="font-medium text-brand-300">R {calc.totalEarningsZar.toLocaleString()}</dd>
              </div>
            </>
          ) : (
            <div className="col-span-2 text-xs text-slate-500">Save to update month-to-date calculations.</div>
          )}
        </dl>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {success ? <p className="text-sm text-brand-300">{success}</p> : null}

      <button
        type="submit"
        disabled={saving || (projects.length === 0 && clients.length === 0) || formLocked}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand-500 disabled:opacity-50"
      >
        {saving ? "Saving…" : editingId ? "Update daily log" : "Save daily log"}
      </button>
    </form>

      <div className="card-tool rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white">Previous logs</h2>
        <p className="mt-1 text-xs text-slate-500">
          Collapsed by default — expand a day to see project cards, then click a card to edit (if unlocked).
        </p>
        {pastEntries.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No other submissions yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {pastEntries.map((s) => {
              const expanded = expandedSubmissionIds.has(s.id);
              return (
                <li key={s.id} className="overflow-hidden rounded-lg ring-1 ring-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => toggleSubmissionExpanded(s.id)}
                    className="flex w-full items-center justify-between gap-2 bg-white/[0.03] px-3 py-2.5 text-left text-sm hover:bg-white/[0.06]"
                  >
                    <span className="flex items-center gap-2 text-slate-300">
                      <span
                        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-white/[0.06] text-xs font-bold text-slate-400"
                        aria-hidden
                      >
                        {expanded ? "−" : "+"}
                      </span>
                      {s.submissionDate} · {s.totalHours}h · {s.lineItems.length} project
                      {s.lineItems.length === 1 ? "" : "s"}
                      {s.lockedAt ? (
                        <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] uppercase text-slate-500">
                          Locked
                        </span>
                      ) : (
                        <span className="text-[10px] text-brand-300">Editable</span>
                      )}
                      {s.checkInRequested ? (
                        <span className="text-[10px] text-amber-300">Check-in</span>
                      ) : null}
                    </span>
                  </button>
                  {expanded ? (
                    <div className="grid gap-2 border-t border-white/[0.06] bg-white/[0.02] p-3 sm:grid-cols-2">
                      {s.lineItems.map((li) => (
                        <button
                          key={li.id}
                          type="button"
                          disabled={!s.editable}
                          onClick={() => loadSubmissionIntoForm(s)}
                          className={`rounded-lg p-3 text-left ring-1 transition-colors ${
                            s.editable
                              ? "cursor-pointer bg-white/[0.04] ring-white/[0.08] hover:bg-brand-500/10 hover:ring-brand-500/25"
                              : "cursor-default bg-white/[0.02] ring-white/[0.06] opacity-80"
                          }`}
                        >
                          <p className="text-sm font-medium text-white">{li.projectName}</p>
                          <p className="text-xs text-slate-500">
                            {li.clientName} · #{li.projectNumber}
                          </p>
                          <p className="mt-2 text-xs text-slate-400">
                            {li.hoursWorked}h
                            {li.completionPercent != null ? ` · ${li.completionPercent}%` : ""}
                          </p>
                          {li.completedSummary ? (
                            <p className="mt-1 line-clamp-2 text-xs text-slate-500">{li.completedSummary}</p>
                          ) : null}
                          {s.editable ? (
                            <p className="mt-2 text-[10px] font-medium text-brand-300">Click to edit this day</p>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <CheckInRequestModal
        open={checkInModalOpen}
        onClose={() => setCheckInModalOpen(false)}
        onSuccess={() => {
          setCheckInDetailsSubmitted(true);
          setSuccess("Check-in request submitted.");
        }}
        source="daily_log"
        projects={projects.map((p) => ({
          id: p.id,
          name: p.name,
          client: { name: p.client.name },
        }))}
      />
    </div>
  );
}
