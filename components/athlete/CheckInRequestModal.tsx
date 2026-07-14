"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DateTimeSplitFields,
  type DateTimeSplitValue,
} from "@/components/DateTimeSplitFields";
import { composeDueAtIso } from "@/lib/planner-due-datetime";

type Project = { id: string; name: string; client?: { name: string } };
type Slot = { start: string; end: string; label: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  source?: "daily_log" | "book_a_call";
  projects?: Project[];
};

export function CheckInRequestModal({
  open,
  onClose,
  onSuccess,
  source = "book_a_call",
  projects: projectsProp,
}: Props) {
  const [projects, setProjects] = useState<Project[]>(projectsProp ?? []);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [projectId, setProjectId] = useState("");
  const [reason, setReason] = useState("");
  const [contextNotes, setContextNotes] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [customStart, setCustomStart] = useState<DateTimeSplitValue>({
    date: "",
    time: "",
    ampm: "AM",
  });
  const [customEnd, setCustomEnd] = useState<DateTimeSplitValue>({
    date: "",
    time: "",
    ampm: "AM",
  });

  const useManualPicker = slots.length === 0;

  const load = useCallback(async () => {
    setLoading(true);
    const fetches: Promise<void>[] = [
      fetch("/api/athlete/book-call/slots")
        .then((r) => r.json())
        .then((j) => {
          setSlots(j.slots || []);
          setCalendarConnected(!!j.calendarConnected);
        }),
    ];
    if (!projectsProp) {
      fetches.push(
        fetch("/api/athlete/projects")
          .then((r) => r.json())
          .then((j) => setProjects(j.projects || []))
      );
    }
    await Promise.all(fetches);
    setLoading(false);
  }, [projectsProp]);

  useEffect(() => {
    if (open) {
      setError("");
      setReason("");
      setContextNotes("");
      setProjectId("");
      setSelectedSlot("");
      void load();
    }
  }, [open, load]);

  useEffect(() => {
    if (projectsProp) setProjects(projectsProp);
  }, [projectsProp]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!reason.trim()) {
      setError("Reason is required");
      return;
    }
    if (!projectId) {
      setError("Project is required");
      return;
    }

    let requestedStartAt: string;
    let requestedEndAt: string;

    if (useManualPicker) {
      const startIso = composeDueAtIso(customStart.date, customStart.time, customStart.ampm);
      const endIso = composeDueAtIso(customEnd.date, customEnd.time, customEnd.ampm);
      if (!startIso || !endIso) {
        setError("Select start and end date/time");
        return;
      }
      requestedStartAt = startIso;
      requestedEndAt = endIso;
    } else {
      if (!selectedSlot) {
        setError("Select a time slot");
        return;
      }
      const slot = slots.find((s) => s.start === selectedSlot);
      if (!slot) {
        setError("Invalid slot");
        return;
      }
      requestedStartAt = slot.start;
      requestedEndAt = slot.end;
    }

    setSaving(true);
    const r = await fetch("/api/athlete/book-call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: projectId || null,
        reason: reason.trim(),
        contextNotes: contextNotes.trim() || null,
        requestedStartAt,
        requestedEndAt,
        source,
      }),
    });
    const j = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) {
      setError((j as { error?: string }).error || "Could not submit check-in request");
      return;
    }
    onSuccess?.();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="check-in-modal-title"
        className="card-tool max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="check-in-modal-title" className="text-lg font-semibold text-white">
              Book a check-in
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Request a call with Jethro. Same flow as Book a Call.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Loading slots…</p>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-4">
            <label className="block text-xs text-slate-400">
              Project <span className="text-red-400">*</span>
              <select
                required
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
              >
                <option value="">Select project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.client?.name ? `${p.client.name} — ` : ""}
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs text-slate-400">
              Reason <span className="text-red-400">*</span>
              <input
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                placeholder="e.g. Need help with elevations"
              />
            </label>

            <label className="block text-xs text-slate-400">
              Context notes (optional)
              <textarea
                value={contextNotes}
                onChange={(e) => setContextNotes(e.target.value)}
                rows={2}
                className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
              />
            </label>

            {useManualPicker ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <DateTimeSplitFields
                  label="Start"
                  value={customStart}
                  onChange={setCustomStart}
                />
                <DateTimeSplitFields
                  label="End"
                  value={customEnd}
                  onChange={setCustomEnd}
                />
              </div>
            ) : (
              <label className="block text-xs text-slate-400">
                Time slot <span className="text-red-400">*</span>
                <select
                  required
                  value={selectedSlot}
                  onChange={(e) => setSelectedSlot(e.target.value)}
                  className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Select…</option>
                  {slots.map((s) => (
                    <option key={s.start} value={s.start}>
                      {s.label}
                    </option>
                  ))}
                </select>
                {calendarConnected ? (
                  <p className="mt-1 text-[10px] text-slate-600">Google Calendar connected</p>
                ) : null}
              </label>
            )}

            {error ? <p className="text-sm text-red-400">{error}</p> : null}

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand-500 disabled:opacity-50"
              >
                {saving ? "Submitting…" : "Submit request"}
              </button>
              <button type="button" onClick={onClose} className="text-sm text-slate-500">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
