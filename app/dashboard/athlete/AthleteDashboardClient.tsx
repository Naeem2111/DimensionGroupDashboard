"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClientAvatar } from "@/components/ops/ClientAvatar";
import { asAvatarTextTone } from "@/lib/avatar-text-tone";

type OpsAlert = {
  code: string;
  severity: "info" | "warning" | "critical";
  message: string;
  linkPath?: string;
};

type DashboardData = {
  profile: {
    fullName: string;
    athleteCode: string;
    profilePhotoUrl: string | null;
    profilePhotoBgColor: string | null;
    profilePhotoTextTone: string | null;
    blocharchStartDate: string;
    monthlyHourCap: number;
  };
  summary: {
    lifetimeHours: number;
    monthHours: number;
    monthOvertimeHours: number;
    hoursRemaining: number;
    totalEarningsZar: number;
  };
  activeProjects: number;
  completedProjects: number;
  openBlockers: number;
  checkInRequests: number;
  unreadNotificationCount: number;
  todayHours: number;
  alerts: OpsAlert[];
  recentSubmissions: Array<{ submissionDate: string; totalHours: number; lockedAt: string | null }>;
  beatenDeadlines: {
    count: number;
    totalDaysBeaten: number;
    recent: Array<{
      id: string;
      name: string;
      clientName: string;
      dueDate: string | null;
      completedAt: string | null;
      daysBeaten: number;
    }>;
  };
};

const severityClass: Record<OpsAlert["severity"], string> = {
  info: "text-slate-300",
  warning: "text-amber-300",
  critical: "text-red-300",
};

export function AthleteDashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/athlete/dashboard")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Failed to load dashboard");
        setData(j);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">Loading dashboard…</p>;

  const { profile, summary } = data;

  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card-tool rounded-xl p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">This month</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
            {summary.monthHours.toFixed(1)} / {profile.monthlyHourCap}h
          </p>
          <p className="mt-1 text-xs text-slate-500">{summary.hoursRemaining.toFixed(1)}h remaining</p>
        </div>
        <div className="card-tool rounded-xl p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Overtime</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-400/90">
            {summary.monthOvertimeHours.toFixed(1)}h
          </p>
        </div>
        <div className="card-tool rounded-xl p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Est. earnings</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-brand-400">
            R {summary.totalEarningsZar.toLocaleString()}
          </p>
        </div>
        <div className="card-tool rounded-xl p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Today</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-200">{data.todayHours.toFixed(1)}h</p>
        </div>
        <div className="card-tool rounded-xl p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">All-time hours</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-200">
            {summary.lifetimeHours.toFixed(0)}h
          </p>
        </div>
        <div className="card-tool rounded-xl p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Projects</p>
          <p className="mt-1 text-lg font-semibold text-white">
            {data.activeProjects} active · {data.completedProjects} done
          </p>
        </div>
      </div>

      <div className="mb-8 flex flex-wrap gap-3">
        <Link
          href="/dashboard/athlete/submissions"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand-500"
        >
          Log today&apos;s work
        </Link>
        <Link
          href="/dashboard/athlete/projects"
          className="rounded-lg bg-white/[0.08] px-4 py-2 text-sm text-slate-200 ring-1 ring-white/[0.08] hover:bg-white/[0.12]"
        >
          View my projects ({data.activeProjects})
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="card-tool rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white">Profile</h2>
          <div className="mt-3 flex items-center gap-3">
            <ClientAvatar
              name={profile.fullName}
              logoUrl={profile.profilePhotoUrl}
              backgroundColor={profile.profilePhotoBgColor}
              textTone={asAvatarTextTone(profile.profilePhotoTextTone)}
              size={48}
              objectFit="cover"
            />
            <div>
              <p className="text-sm text-slate-300">
                {profile.fullName} · {profile.athleteCode}
              </p>
              <p className="text-xs text-slate-500">Started {profile.blocharchStartDate}</p>
            </div>
          </div>
        </div>
        <div className="card-tool rounded-xl p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">Alerts</h2>
            {data.unreadNotificationCount ? (
              <Link href="/dashboard/athlete/notifications" className="text-xs text-brand-400 hover:text-brand-300">
                {data.unreadNotificationCount} unread →
              </Link>
            ) : null}
          </div>
          {data.alerts.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No active alerts.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.alerts.map((a) => (
                <li key={a.code} className={`text-sm ${severityClass[a.severity]}`}>
                  {a.linkPath ? (
                    <Link href={a.linkPath} className="hover:underline">
                      {a.message}
                    </Link>
                  ) : (
                    a.message
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card-tool rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white">Beaten deadlines</h2>
          <p className="mt-1 text-xs text-slate-500">Projects you finished before the due date.</p>
          {data.beatenDeadlines.count === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No early completions recorded yet.</p>
          ) : (
            <>
              <p className="mt-3 text-lg font-semibold tabular-nums text-emerald-300">
                {data.beatenDeadlines.count} project{data.beatenDeadlines.count === 1 ? "" : "s"} ·{" "}
                {data.beatenDeadlines.totalDaysBeaten}d total early
              </p>
              <ul className="mt-3 space-y-2">
                {data.beatenDeadlines.recent.slice(0, 5).map((p) => (
                  <li key={p.id} className="text-sm text-slate-300">
                    <span className="font-medium text-slate-200">{p.name}</span>
                    <span className="text-slate-500"> · {p.clientName}</span>
                    <span className="ml-1 text-emerald-300">{p.daysBeaten}d early</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div className="card-tool rounded-xl p-5 md:col-span-2">
          <h2 className="text-sm font-semibold text-white">Recent submissions</h2>
          {data.recentSubmissions.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No submissions yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.recentSubmissions.map((s) => (
                <li key={s.submissionDate} className="flex justify-between text-sm text-slate-300">
                  <span>
                    {s.submissionDate}
                    {s.lockedAt ? (
                      <span className="ml-2 text-[10px] uppercase text-slate-500">Locked</span>
                    ) : null}
                  </span>
                  <span>{s.totalHours}h</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
