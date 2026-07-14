"use client";

import { useCallback, useEffect, useState } from "react";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  actionRequired: string | null;
  athleteName: string | null;
  athleteCode: string | null;
  projectName: string | null;
  readAt: string | null;
  createdAt: string;
};

const TYPE_LABEL: Record<string, string> = {
  check_in_request: "Check-in request",
  zoom_check_in: "Zoom check-in",
  review_request: "Review request",
  blocker: "Blocker",
  project_question: "Project question",
  completed_task: "Task update",
  daily_submission_flag: "Daily submission",
  birthday: "Birthday",
};

export function OpsNotificationsClient() {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterUnread, setFilterUnread] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const q = filterUnread ? "?unread=1" : "";
    const r = await fetch(`/api/ops/notifications${q}`);
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      setRows(j.notifications || []);
      setUnreadCount(j.unreadCount ?? 0);
    }
    setLoading(false);
  }, [filterUnread]);

  useEffect(() => {
    load();
  }, [load]);

  async function markRead(id: string, read: boolean) {
    await fetch(`/api/ops/notifications/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read }),
    });
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          {unreadCount} unread — check-ins, blockers, and items needing your attention.
        </p>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={filterUnread}
            onChange={(e) => setFilterUnread(e.target.checked)}
            className="rounded border-white/20"
          />
          Unread only
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">No notifications.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((n) => (
            <li
              key={n.id}
              className={`rounded-xl border px-4 py-3 ${
                n.readAt
                  ? "border-white/[0.06] bg-white/[0.02] opacity-75"
                  : "border-brand-500/25 bg-brand-500/5"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {TYPE_LABEL[n.type] ?? n.type}
                    {n.readAt ? "" : " · New"}
                  </p>
                  <p className="mt-1 font-medium text-slate-100">{n.title}</p>
                  {n.athleteName ? (
                    <p className="mt-1 text-sm text-slate-400">
                      {n.athleteName}
                      {n.athleteCode ? ` (${n.athleteCode})` : ""}
                      {n.projectName ? ` · ${n.projectName}` : ""}
                    </p>
                  ) : null}
                  {n.message ? <p className="mt-2 text-sm text-slate-400">{n.message}</p> : null}
                  {n.actionRequired ? (
                    <p className="mt-1 text-sm text-amber-200/90">{n.actionRequired}</p>
                  ) : null}
                  <p className="mt-2 text-[11px] text-slate-600">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void markRead(n.id, !n.readAt)}
                  className="shrink-0 rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.1]"
                >
                  {n.readAt ? "Mark unread" : "Mark read"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
