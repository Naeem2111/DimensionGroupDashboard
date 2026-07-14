"use client";

import { useCallback, useEffect, useState } from "react";
import { AthleteAvatar } from "@/components/ops/AthleteAvatar";
import { asAvatarTextTone } from "@/lib/avatar-text-tone";

type RequestRow = {
  id: string;
  source: string;
  athleteName: string;
  athleteCode: string;
  profilePhotoUrl: string | null;
  profilePhotoBgColor: string | null;
  profilePhotoTextTone: string | null;
  projectName: string | null;
  clientName: string | null;
  reason: string;
  contextNotes: string | null;
  requestedStartAt: string;
  status: string;
  createdAt?: string;
};

type ManagerStatus = "pending" | "scheduled";

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toManagerStatus(status: string): ManagerStatus {
  if (status === "approved" || status === "confirmed") return "scheduled";
  return "pending";
}

function checkInStatusMeta(status: string): { label: string; cardClass: string; badgeClass: string } {
  const manager = toManagerStatus(status);
  if (manager === "pending") {
    return {
      label: "Pending / Unscheduled",
      cardClass: "border-l-4 border-l-red-500/70 ring-1 ring-red-500/20",
      badgeClass: "bg-red-500/15 text-red-300",
    };
  }
  return {
    label: "Scheduled",
    cardClass: "border-l-4 border-l-emerald-500/70",
    badgeClass: "bg-emerald-500/15 text-emerald-300",
  };
}

export function OpsCheckInRequestsClient() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "scheduled">("pending");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const q = filter === "pending" ? "?status=pending" : "?status=scheduled";
    const r = await fetch(`/api/ops/check-in-requests${q}`);
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      setRows(j.requests || []);
      setPendingCount(j.pendingCount ?? 0);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  async function setStatus(id: string, status: ManagerStatus) {
    setBusyId(id);
    const r = await fetch(`/api/ops/check-in-requests/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_status", status }),
    });
    const j = await r.json().catch(() => ({}));
    setBusyId(null);
    if (!r.ok) {
      window.alert((j as { error?: string }).error || "Update failed");
      return;
    }
    await load();
  }

  return (
    <div className="space-y-6">
      {pendingCount > 0 ? (
        <div
          className="animate-pulse rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 ring-1 ring-red-500/35"
          role="status"
        >
          <p className="text-sm font-semibold text-red-100">
            {pendingCount} check-in request{pendingCount === 1 ? "" : "s"} awaiting action
          </p>
          <p className="mt-1 text-xs text-red-200/80">
            Mark Scheduled once you have arranged the meeting. This alert stays until each request is
            actioned.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={`text-sm ${pendingCount > 0 ? "font-medium text-red-200" : "text-slate-400"}`}>
          {pendingCount} pending / unscheduled
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFilter("pending")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ring-1 ${
              filter === "pending"
                ? pendingCount > 0
                  ? "animate-pulse bg-red-500/15 text-red-200 ring-red-500/40"
                  : "bg-brand-500/20 text-brand-200 ring-brand-500/30"
                : "bg-white/[0.04] text-slate-400 ring-white/[0.08]"
            }`}
          >
            Check-in requests
            {pendingCount > 0 ? (
              <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                {pendingCount > 99 ? "99+" : pendingCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setFilter("scheduled")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ring-1 ${
              filter === "scheduled"
                ? "bg-brand-500/20 text-brand-200 ring-brand-500/30"
                : "bg-white/[0.04] text-slate-400 ring-white/[0.08]"
            }`}
          >
            Scheduled meetings
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">
          {filter === "pending" ? "No pending check-in requests." : "No scheduled meetings."}
        </p>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => {
            const statusMeta = checkInStatusMeta(r.status);
            const managerStatus = toManagerStatus(r.status);
            return (
              <li key={r.id} className={`card-tool rounded-xl p-4 ${statusMeta.cardClass}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-white">
                      <AthleteAvatar
                        name={r.athleteName}
                        photoUrl={r.profilePhotoUrl}
                        backgroundColor={r.profilePhotoBgColor}
                        textTone={asAvatarTextTone(r.profilePhotoTextTone)}
                        size={32}
                      />
                      <span>
                        {r.athleteName}{" "}
                        <span className="text-xs font-normal text-slate-500">({r.athleteCode})</span>
                      </span>
                    </p>
                    {r.projectName ? (
                      <p className="text-sm text-slate-400">
                        <span className="text-slate-500">Project:</span> {r.projectName}
                      </p>
                    ) : null}
                    {r.clientName ? (
                      <p className="text-sm text-slate-400">
                        <span className="text-slate-500">Client:</span> {r.clientName}
                      </p>
                    ) : null}
                    <p className="text-sm text-slate-200">
                      <span className="text-slate-500">Reason:</span> {r.reason}
                    </p>
                    <p className="text-sm text-brand-200/90">
                      <span className="text-slate-500">Requested:</span> {formatWhen(r.requestedStartAt)}
                    </p>
                    {r.contextNotes ? (
                      <p className="text-sm text-slate-400">
                        <span className="text-slate-500">Notes:</span> {r.contextNotes}
                      </p>
                    ) : null}
                    <p className="text-[10px] text-slate-500">
                      Source: {r.source === "daily_log" ? "Daily Log" : "Book a Call"}
                    </p>
                    <span
                      className={`mt-1 inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${statusMeta.badgeClass}`}
                    >
                      {statusMeta.label}
                    </span>
                  </div>
                  <label className="text-xs text-slate-400">
                    Status
                    <select
                      disabled={busyId === r.id}
                      value={managerStatus}
                      onChange={(e) => void setStatus(r.id, e.target.value as ManagerStatus)}
                      className="select-console mt-1 block min-w-[11rem] rounded-md px-3 py-2 text-sm"
                    >
                      <option value="pending">Pending / Unscheduled</option>
                      <option value="scheduled">Scheduled</option>
                    </select>
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
