"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckInRequestModal } from "@/components/athlete/CheckInRequestModal";

type Project = { id: string; name: string; client: { name: string } };
type RequestRow = {
  id: string;
  projectName: string | null;
  reason: string;
  contextNotes: string | null;
  requestedStartAt: string;
  status: string;
  createdAt: string;
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function athleteStatusLabel(status: string): string {
  if (status === "approved" || status === "confirmed") return "Scheduled";
  if (status === "declined" || status === "cancelled") return "Closed";
  return "Pending";
}

export function AthleteBookCallClient() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [success, setSuccess] = useState("");

  const refresh = useCallback(async () => {
    const [projR, reqR] = await Promise.all([
      fetch("/api/athlete/projects"),
      fetch("/api/athlete/book-call"),
    ]);
    const [projJ, reqJ] = await Promise.all([
      projR.json().catch(() => ({})),
      reqR.json().catch(() => ({})),
    ]);
    if (projR.ok) setProjects(projJ.projects || []);
    if (reqR.ok) setRequests(reqJ.requests || []);
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="space-y-8">
      <div className="card-tool rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white">Book a check-in</h2>
        <p className="mt-1 text-sm text-slate-400">
          Submit project, reason, preferred time, and notes. Jethro will arrange the meeting and mark it scheduled.
        </p>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand-500"
        >
          Request check-in
        </button>
        {success ? <p className="mt-3 text-sm text-brand-300">{success}</p> : null}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Your requests</h2>
        {requests.length === 0 ? (
          <p className="text-sm text-slate-500">No check-in requests yet.</p>
        ) : (
          <ul className="space-y-3">
            {requests.map((r) => (
              <li key={r.id} className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                <p className="font-medium text-slate-100">{r.reason}</p>
                {r.projectName ? <p className="text-xs text-slate-500">{r.projectName}</p> : null}
                <p className="mt-1 text-sm text-slate-400">{formatWhen(r.requestedStartAt)}</p>
                {r.contextNotes ? (
                  <p className="mt-1 text-sm text-slate-500">{r.contextNotes}</p>
                ) : null}
                <span className="mt-2 inline-block rounded bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-400">
                  {athleteStatusLabel(r.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CheckInRequestModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={async () => {
          setSuccess("Check-in request sent.");
          await refresh();
        }}
        source="book_a_call"
        projects={projects}
      />
    </div>
  );
}
