"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Row = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  linkPath: string | null;
  readAt: string | null;
  createdAt: string;
};

const TYPE_LABELS: Record<string, string> = {
  task_assigned: "New task",
  check_in_update: "Check-in",
  project_completed: "Project",
  admin_message: "Message",
};

export function AthleteNotificationsClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const r = await fetch("/api/athlete/notifications?limit=80");
    const j = await r.json();
    if (r.ok) {
      setRows(j.notifications || []);
      setUnreadCount(j.unreadCount ?? 0);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(id: string) {
    await fetch(`/api/athlete/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
    void load();
  }

  async function markAllRead() {
    const unread = rows.filter((r) => !r.readAt);
    await Promise.all(
      unread.map((r) =>
        fetch(`/api/athlete/notifications/${r.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ read: true }),
        })
      )
    );
    void load();
  }

  if (loading) return <p className="text-sm text-slate-500">Loading notifications…</p>;

  return (
    <div className="space-y-4">
      {unreadCount > 0 ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-brand-300">{unreadCount} unread</p>
          <button
            type="button"
            onClick={() => void markAllRead()}
            className="text-xs font-medium text-slate-400 hover:text-white"
          >
            Mark all read
          </button>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No notifications yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((n) => (
            <li
              key={n.id}
              className={`card-tool rounded-xl p-4 ${n.readAt ? "opacity-75" : "ring-1 ring-brand-500/20"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {TYPE_LABELS[n.type] ?? n.type}
                  </span>
                  <h3 className="mt-1 text-sm font-semibold text-white">{n.title}</h3>
                  {n.message ? <p className="mt-1 text-sm text-slate-400">{n.message}</p> : null}
                  <p className="mt-2 text-[11px] text-slate-600">
                    {new Date(n.createdAt).toLocaleString("en-GB")}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {!n.readAt ? (
                    <button
                      type="button"
                      onClick={() => void markRead(n.id)}
                      className="text-xs text-brand-300 hover:text-brand-200"
                    >
                      Mark read
                    </button>
                  ) : null}
                  {n.linkPath ? (
                    <Link
                      href={n.linkPath}
                      onClick={() => {
                        if (!n.readAt) void markRead(n.id);
                      }}
                      className="text-xs font-medium text-brand-400 hover:text-brand-300"
                    >
                      Open →
                    </Link>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
