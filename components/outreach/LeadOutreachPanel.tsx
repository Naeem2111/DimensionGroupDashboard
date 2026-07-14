"use client";

import { useCallback, useEffect, useState } from "react";
import {
  COMMUNICATION_DIRECTIONS,
  COMMUNICATION_TYPE_LABELS,
  COMMUNICATION_TYPES,
  type CommunicationDirection,
  type CommunicationType,
  type OutreachLogRecord,
  type OutreachSummary,
} from "@/lib/lead-outreach";
import { LEAD_STAGES, type LeadStage } from "@/lib/leads";
import {
  followUpStatusColor,
  followUpStatusLabel,
  LEAD_STAGE_COLORS,
  LEAD_STAGE_LABELS,
} from "@/lib/lead-stage-ui";

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function LogEntryCard({
  log,
  slug,
  defaultOpen,
  onEdit,
  onDeleted,
}: {
  log: OutreachLogRecord;
  slug: string;
  defaultOpen?: boolean;
  onEdit: (log: OutreachLogRecord) => void;
  onDeleted: (summary: OutreachSummary) => void;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [deleting, setDeleting] = useState(false);
  const stageColor = LEAD_STAGE_COLORS[log.stageAtLog] ?? "#64748b";

  async function remove() {
    if (!window.confirm("Delete this outreach log entry?")) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/leads/${encodeURIComponent(slug)}/outreach-log/${encodeURIComponent(log.id)}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(data.error || "Could not delete log entry");
        return;
      }
      onDeleted(data.summary);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article className="rounded-xl border border-white/[0.08] bg-white/[0.02] ring-1 ring-white/[0.04]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <span
          className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-bold text-white"
          style={{ backgroundColor: open ? "#0891b2" : "#334155" }}
          aria-hidden
        >
          {open ? "−" : "+"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-white">
              {COMMUNICATION_TYPE_LABELS[log.communicationType]}
            </span>
            <span className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400 ring-1 ring-white/10">
              {log.direction}
            </span>
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
              style={{ backgroundColor: `${stageColor}22`, color: stageColor }}
            >
              {LEAD_STAGE_LABELS[log.stageAtLog]}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(log.contactDate)}</p>
          {log.subject ? <p className="mt-1 truncate text-xs text-slate-400">{log.subject}</p> : null}
        </div>
      </button>
      {open ? (
        <div className="space-y-3 border-t border-white/[0.06] px-4 py-3 text-sm">
          {log.contactPerson ? (
            <p>
              <span className="text-slate-500">Contact:</span>{" "}
              <span className="text-slate-200">{log.contactPerson}</span>
            </p>
          ) : null}
          {log.emailAddress ? (
            <p>
              <span className="text-slate-500">Email:</span>{" "}
              <span className="text-slate-200">{log.emailAddress}</span>
            </p>
          ) : null}
          {log.messageBody ? (
            <div>
              <p className="mb-1 text-xs uppercase tracking-wider text-slate-500">Message sent</p>
              <p className="whitespace-pre-wrap text-sm text-slate-300">{log.messageBody}</p>
            </div>
          ) : null}
          {log.replyReceived ? (
            <div>
              <p className="mb-1 text-xs uppercase tracking-wider text-slate-500">Reply received</p>
              <p className="whitespace-pre-wrap text-sm text-slate-300">{log.replyReceived}</p>
            </div>
          ) : null}
          {log.internalNotes ? (
            <div>
              <p className="mb-1 text-xs uppercase tracking-wider text-slate-500">Internal notes</p>
              <p className="whitespace-pre-wrap text-sm text-slate-400">{log.internalNotes}</p>
            </div>
          ) : null}
          {log.followUpDueAt ? (
            <p className="text-xs text-slate-400">Follow-up due: {formatDate(log.followUpDueAt)}</p>
          ) : null}
          {log.nextAction ? <p className="text-xs text-brand-300">Next action: {log.nextAction}</p> : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => onEdit(log)}
              className="rounded-lg border border-white/[0.12] px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.06]"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => void remove()}
              disabled={deleting}
              className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function logToForm(log: OutreachLogRecord) {
  return {
    stageAtLog: log.stageAtLog,
    communicationType: log.communicationType,
    direction: log.direction,
    contactPerson: log.contactPerson ?? "",
    emailAddress: log.emailAddress ?? "",
    subject: log.subject ?? "",
    messageBody: log.messageBody ?? "",
    replyReceived: log.replyReceived ?? "",
    internalNotes: log.internalNotes ?? "",
    contactDate: log.contactDate.slice(0, 10),
    followUpDueAt: log.followUpDueAt?.slice(0, 10) ?? "",
    nextAction: log.nextAction ?? "",
  };
}

function OutreachLogForm({
  slug,
  defaultStage,
  defaultEmail,
  defaultContact,
  editingLog,
  onCreated,
  onUpdated,
  onCancelEdit,
}: {
  slug: string;
  defaultStage: LeadStage;
  defaultEmail?: string;
  defaultContact?: string;
  editingLog?: OutreachLogRecord | null;
  onCreated: (log: OutreachLogRecord, summary: OutreachSummary) => void;
  onUpdated?: (log: OutreachLogRecord, summary: OutreachSummary) => void;
  onCancelEdit?: () => void;
}) {
  const isEdit = !!editingLog;
  const [open, setOpen] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(() =>
    editingLog
      ? logToForm(editingLog)
      : {
          stageAtLog: defaultStage,
          communicationType: "first_email" as CommunicationType,
          direction: "outbound" as CommunicationDirection,
          contactPerson: defaultContact ?? "",
          emailAddress: defaultEmail ?? "",
          subject: "",
          messageBody: "",
          replyReceived: "",
          internalNotes: "",
          contactDate: new Date().toISOString().slice(0, 10),
          followUpDueAt: "",
          nextAction: "",
        }
  );

  useEffect(() => {
    if (editingLog) {
      setForm(logToForm(editingLog));
      setOpen(true);
      return;
    }
    setForm((f) => ({ ...f, stageAtLog: defaultStage }));
  }, [defaultStage, editingLog]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const url = isEdit
        ? `/api/leads/${encodeURIComponent(slug)}/outreach-log/${encodeURIComponent(editingLog!.id)}`
        : `/api/leads/${encodeURIComponent(slug)}/outreach-log`;
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          followUpDueAt: form.followUpDueAt || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to save log entry");
        return;
      }
      if (isEdit && onUpdated) {
        onUpdated(data.log, data.summary);
        onCancelEdit?.();
      } else {
        onCreated(data.log, data.summary);
      }
      if (!isEdit) {
        setOpen(false);
        setForm((f) => ({
          ...f,
          subject: "",
          messageBody: "",
          replyReceived: "",
          internalNotes: "",
          followUpDueAt: "",
          nextAction: "",
          contactDate: new Date().toISOString().slice(0, 10),
          stageAtLog: data.summary.effectiveStage,
        }));
      }
    } finally {
      setSaving(false);
    }
  }

  if (!open && !isEdit) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-brand-primary w-full rounded-lg px-4 py-2.5 text-sm"
      >
        + Log outreach
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="space-y-3 rounded-xl border border-brand-500/30 bg-brand-500/5 p-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">
          {isEdit ? "Edit outreach log" : "New outreach log"}
        </h3>
        <button
          type="button"
          onClick={() => {
            if (isEdit) onCancelEdit?.();
            else setOpen(false);
          }}
          className="text-xs text-slate-500 hover:text-slate-300"
        >
          Cancel
        </button>
      </div>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-slate-400">
          Stage at log
          <select
            value={form.stageAtLog}
            onChange={(e) => setForm({ ...form, stageAtLog: e.target.value as LeadStage })}
            className="select-console mt-1 w-full rounded-lg px-2 py-1.5 text-sm"
          >
            {LEAD_STAGES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-slate-400">
          Date sent / received
          <input
            type="date"
            value={form.contactDate}
            onChange={(e) => setForm({ ...form, contactDate: e.target.value })}
            className="field-console mt-1 w-full rounded-lg px-2 py-1.5 text-sm"
            required
          />
        </label>
        <label className="block text-xs text-slate-400">
          Communication type
          <select
            value={form.communicationType}
            onChange={(e) => setForm({ ...form, communicationType: e.target.value as CommunicationType })}
            className="select-console mt-1 w-full rounded-lg px-2 py-1.5 text-sm"
          >
            {COMMUNICATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {COMMUNICATION_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-slate-400">
          Direction
          <select
            value={form.direction}
            onChange={(e) => setForm({ ...form, direction: e.target.value as CommunicationDirection })}
            className="select-console mt-1 w-full rounded-lg px-2 py-1.5 text-sm"
          >
            {COMMUNICATION_DIRECTIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-slate-400">
          Contact person
          <input
            value={form.contactPerson}
            onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
            className="field-console mt-1 w-full rounded-lg px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs text-slate-400">
          Email address
          <input
            type="email"
            value={form.emailAddress}
            onChange={(e) => setForm({ ...form, emailAddress: e.target.value })}
            className="field-console mt-1 w-full rounded-lg px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      <label className="block text-xs text-slate-400">
        Subject line
        <input
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
          className="field-console mt-1 w-full rounded-lg px-2 py-1.5 text-sm"
        />
      </label>
      <label className="block text-xs text-slate-400">
        Message / email sent
        <textarea
          value={form.messageBody}
          onChange={(e) => setForm({ ...form, messageBody: e.target.value })}
          rows={4}
          className="field-console mt-1 w-full resize-y rounded-lg px-2 py-1.5 text-sm"
        />
      </label>
      <label className="block text-xs text-slate-400">
        Reply received
        <textarea
          value={form.replyReceived}
          onChange={(e) => setForm({ ...form, replyReceived: e.target.value })}
          rows={3}
          className="field-console mt-1 w-full resize-y rounded-lg px-2 py-1.5 text-sm"
        />
      </label>
      <label className="block text-xs text-slate-400">
        Internal notes
        <textarea
          value={form.internalNotes}
          onChange={(e) => setForm({ ...form, internalNotes: e.target.value })}
          rows={2}
          className="field-console mt-1 w-full resize-y rounded-lg px-2 py-1.5 text-sm"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-slate-400">
          Next follow-up due
          <input
            type="date"
            value={form.followUpDueAt}
            onChange={(e) => setForm({ ...form, followUpDueAt: e.target.value })}
            className="field-console mt-1 w-full rounded-lg px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs text-slate-400">
          Next action
          <input
            value={form.nextAction}
            onChange={(e) => setForm({ ...form, nextAction: e.target.value })}
            className="field-console mt-1 w-full rounded-lg px-2 py-1.5 text-sm"
            placeholder="e.g. Send second follow-up"
          />
        </label>
      </div>
      <button type="submit" disabled={saving} className="btn-brand-primary rounded-lg px-4 py-2 text-sm disabled:opacity-50">
        {saving ? "Saving…" : isEdit ? "Save changes" : "Save log entry"}
      </button>
    </form>
  );
}

export function LeadOutreachPanel({
  slug,
  practiceEmail,
  practiceContact,
}: {
  slug: string;
  practiceEmail?: string;
  practiceContact?: string;
}) {
  const [logs, setLogs] = useState<OutreachLogRecord[]>([]);
  const [summary, setSummary] = useState<OutreachSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingLog, setEditingLog] = useState<OutreachLogRecord | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/leads/${encodeURIComponent(slug)}/outreach-log`);
    if (!res.ok) return;
    const data = await res.json();
    setLogs(data.logs ?? []);
    setSummary(data.summary ?? null);
  }, [slug]);

  useEffect(() => {
    void reload().finally(() => setLoading(false));
  }, [reload]);

  function onCreated(log: OutreachLogRecord, newSummary: OutreachSummary) {
    setLogs((prev) => [log, ...prev]);
    setSummary(newSummary);
  }

  function onUpdated(log: OutreachLogRecord, newSummary: OutreachSummary) {
    setLogs((prev) => prev.map((row) => (row.id === log.id ? log : row)));
    setSummary(newSummary);
    setEditingLog(null);
  }

  function handleDeletedFromCard(logId: string, newSummary: OutreachSummary) {
    setLogs((prev) => prev.filter((row) => row.id !== logId));
    setSummary(newSummary);
    if (editingLog?.id === logId) setEditingLog(null);
  }

  if (loading) return <p className="text-slate-500 text-sm">Loading outreach…</p>;

  const effectiveColor = summary
    ? LEAD_STAGE_COLORS[summary.effectiveStage] ?? "#64748b"
    : "#64748b";

  return (
    <div className="space-y-6">
      {summary ? (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 ring-1 ring-white/[0.04]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Current status</p>
              <p
                className="mt-1 inline-flex items-center gap-2 rounded-lg px-2.5 py-1 text-sm font-semibold"
                style={{ backgroundColor: `${effectiveColor}22`, color: effectiveColor }}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: effectiveColor }} />
                {LEAD_STAGE_LABELS[summary.effectiveStage]}
              </p>
            </div>
            {summary.followUpStatus !== "none" ? (
              <span
                className="rounded-lg px-2 py-1 text-xs font-semibold uppercase"
                style={{
                  color: followUpStatusColor(summary.followUpStatus),
                  backgroundColor: `${followUpStatusColor(summary.followUpStatus)}18`,
                }}
              >
                {followUpStatusLabel(summary.followUpStatus)}
              </span>
            ) : null}
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">First contacted</dt>
              <dd className="text-slate-200">{formatDate(summary.firstContactedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Last contacted</dt>
              <dd className="text-slate-200">{formatDate(summary.lastContactedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Next follow-up</dt>
              <dd className="text-slate-200">{formatDate(summary.followUpDueAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Touches</dt>
              <dd className="text-slate-200">{summary.touchCount}</dd>
            </div>
          </dl>
          {summary.nextAction ? (
            <p className="mt-3 text-sm text-brand-300">
              <span className="text-slate-500">Next action:</span> {summary.nextAction}
            </p>
          ) : null}
        </div>
      ) : null}

      <OutreachLogForm
        slug={slug}
        defaultStage={summary?.effectiveStage ?? "cold"}
        defaultEmail={practiceEmail}
        defaultContact={practiceContact}
        editingLog={editingLog}
        onCreated={onCreated}
        onUpdated={onUpdated}
        onCancelEdit={() => setEditingLog(null)}
      />

      <div>
        <h3 className="mb-3 text-sm font-semibold text-white">Outreach timeline</h3>
        {logs.length === 0 ? (
          <p className="text-sm text-slate-500">No outreach logged yet. Add your first email or call above.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log, i) => (
              <LogEntryCard
                key={log.id}
                log={log}
                slug={slug}
                defaultOpen={i === 0 && !editingLog}
                onEdit={setEditingLog}
                onDeleted={(newSummary) => handleDeletedFromCard(log.id, newSummary)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
