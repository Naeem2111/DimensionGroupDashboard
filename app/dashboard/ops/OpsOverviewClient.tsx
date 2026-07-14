"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AthleteAvatar } from "@/components/ops/AthleteAvatar";
import { SimpleBarChart } from "@/components/ops/SimpleBarChart";
import { asAvatarTextTone } from "@/lib/avatar-text-tone";

type TopPerformer = {
  athleteId: string;
  athleteName: string;
  profilePhotoUrl: string | null;
  profilePhotoBgColor: string | null;
  profilePhotoTextTone: string | null;
  hoursWorked: number;
  revenueGbp: number;
  marginGbp: number;
  marginPercent: number;
  beatenCount: number;
  totalDaysBeaten: number;
  averageDaysBeaten: number;
};

type BeatenDeadlinesByAthlete = {
  athleteId: string;
  athleteName: string;
  profilePhotoUrl: string | null;
  profilePhotoBgColor: string | null;
  profilePhotoTextTone: string | null;
  beatenCount: number;
  totalDaysBeaten: number;
  averageDaysBeaten: number;
  projects: Array<{
    projectId: string;
    projectName: string;
    clientName: string;
    dueDate: string;
    completedDate: string;
    daysBeaten: number;
  }>;
};

type OverviewData = {
  month: string;
  viewerRole?: "admin" | "manager" | "user";
  activeAthletes: number;
  activeProjects: number;
  openBlockers: number;
  checkInRequests: number;
  monthlyRevenueGbp?: number;
  grossMarginGbp?: number;
  grossMarginPercent?: number;
  alertCounts: { daily12Count: number; daily14Count: number; capExceededCount: number };
  topPerformers: TopPerformer[];
  beatenDeadlinesByAthlete: BeatenDeadlinesByAthlete[];
};

function StatCard({
  label,
  value,
  sub,
  alert,
}: {
  label: string;
  value: string | number;
  sub?: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-5 ${
        alert
          ? "animate-pulse border border-red-500/40 bg-red-500/[0.06] ring-1 ring-red-500/35"
          : "card-tool"
      }`}
    >
      <p className={`text-[10px] font-semibold uppercase tracking-wider ${alert ? "text-red-300" : "text-slate-500"}`}>
        {label}
      </p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${alert ? "text-red-100" : "text-white"}`}>
        {value}
      </p>
      {sub ? <p className={`mt-1 text-xs ${alert ? "text-red-200/80" : "text-slate-500"}`}>{sub}</p> : null}
    </div>
  );
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Date(y, m - 1, 1).toLocaleString("en-GB", { month: "long", year: "numeric" });
}

export function OpsOverviewClient() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/ops/overview")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Failed to load");
        setData(j);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  const showFinancials = data?.viewerRole === "admin" && data.monthlyRevenueGbp != null;

  const beatenBars = useMemo(
    () =>
      (data?.beatenDeadlinesByAthlete ?? []).map((a) => ({
        label: a.athleteName,
        value: a.beatenCount,
        sublabel: `${a.totalDaysBeaten}d total · avg ${a.averageDaysBeaten}d early`,
        showAvatar: true,
        imageUrl: a.profilePhotoUrl,
        imageBgColor: a.profilePhotoBgColor,
        imageTextTone: a.profilePhotoTextTone,
        objectFit: "cover" as const,
      })),
    [data]
  );

  const beatenRows = useMemo(
    () =>
      (data?.beatenDeadlinesByAthlete ?? []).flatMap((a) =>
        a.projects.map((p) => ({
          ...p,
          athleteName: a.athleteName,
          profilePhotoUrl: a.profilePhotoUrl,
          profilePhotoBgColor: a.profilePhotoBgColor,
          profilePhotoTextTone: a.profilePhotoTextTone,
        }))
      ),
    [data]
  );

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">Loading overview…</p>;

  return (
    <div className="space-y-8">
      <p className="text-sm text-slate-400">
        {formatMonthLabel(data.month)} · performance and operations snapshot
        {data.viewerRole === "manager" ? (
          <span className="ml-2 text-xs text-amber-400/90">Manager view</span>
        ) : null}
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Active athletes" value={data.activeAthletes} />
        <StatCard label="Active projects" value={data.activeProjects} />
        <StatCard
          label="Pending check-ins"
          value={data.checkInRequests}
          sub="Athletes waiting for a response"
          alert={data.checkInRequests > 0}
        />
        {showFinancials ? (
          <>
            <StatCard
              label="Monthly revenue (GBP)"
              value={`£${data.monthlyRevenueGbp!.toLocaleString()}`}
              sub="From lane hours this month"
            />
            <StatCard
              label="Gross margin"
              value={`£${data.grossMarginGbp!.toLocaleString()}`}
              sub={`${data.grossMarginPercent}% of revenue`}
            />
          </>
        ) : null}
        <div className={`card-tool rounded-xl p-5 ${showFinancials ? "md:col-span-2 lg:col-span-3" : "md:col-span-2 lg:col-span-3"}`}>
          <h2 className="text-sm font-semibold text-white">Hour alerts this month</h2>
          <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-slate-500">12h+ daily logs</dt>
              <dd className="text-lg font-semibold text-amber-300">{data.alertCounts.daily12Count}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">14h+ daily logs</dt>
              <dd className="text-lg font-semibold text-red-300">{data.alertCounts.daily14Count}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Athletes over cap</dt>
              <dd className="text-lg font-semibold text-orange-300">{data.alertCounts.capExceededCount}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="card-tool rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Top performing athletes</h2>
            <p className="mt-1 text-xs text-slate-500">
              Ranked by early deadline completions, then hours logged this month
              {showFinancials ? " and margin produced." : "."}
            </p>
          </div>
          {showFinancials ? (
            <Link href="/dashboard/ops/analytics" className="text-xs text-brand-300 hover:text-brand-200">
              Full analytics →
            </Link>
          ) : null}
        </div>
        {data.topPerformers.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No athlete activity recorded this month yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-xs uppercase text-slate-500">
                  <th className="px-3 py-2">Athlete</th>
                  <th className="px-3 py-2">Hours</th>
                  <th className="px-3 py-2">Beaten deadlines</th>
                  <th className="px-3 py-2">Days early</th>
                  {showFinancials ? (
                    <>
                      <th className="px-3 py-2">Revenue</th>
                      <th className="px-3 py-2">Margin</th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {data.topPerformers.map((a) => (
                  <tr key={a.athleteId} className="border-b border-white/[0.04] text-slate-300">
                    <td className="px-3 py-2 font-medium text-white">
                      <span className="inline-flex items-center gap-2">
                        <AthleteAvatar
                          name={a.athleteName}
                          photoUrl={a.profilePhotoUrl}
                          backgroundColor={a.profilePhotoBgColor}
                          textTone={asAvatarTextTone(a.profilePhotoTextTone)}
                          size={28}
                        />
                        {a.athleteName}
                      </span>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{a.hoursWorked}h</td>
                    <td className="px-3 py-2 tabular-nums">{a.beatenCount}</td>
                    <td className="px-3 py-2 tabular-nums text-emerald-300">
                      {a.totalDaysBeaten > 0 ? `${a.totalDaysBeaten}d` : "—"}
                    </td>
                    {showFinancials ? (
                      <>
                        <td className="px-3 py-2 tabular-nums">£{a.revenueGbp.toLocaleString()}</td>
                        <td className="px-3 py-2 tabular-nums text-brand-300">
                          £{a.marginGbp.toLocaleString()} ({a.marginPercent}%)
                        </td>
                      </>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card-tool rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white">Beaten deadlines</h2>
        <p className="mt-1 text-xs text-slate-500">
          Projects completed before their due date in {formatMonthLabel(data.month)} — useful for
          performance recognition and bonus planning.
        </p>
        {beatenBars.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No beaten deadlines this month.</p>
        ) : (
          <>
            <div className="mt-4 max-w-xl">
              <SimpleBarChart items={beatenBars} valueSuffix="" />
            </div>
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-xs uppercase text-slate-500">
                    <th className="px-3 py-2">Athlete</th>
                    <th className="px-3 py-2">Project</th>
                    <th className="px-3 py-2">Client</th>
                    <th className="px-3 py-2">Completed</th>
                    <th className="px-3 py-2">Due</th>
                    <th className="px-3 py-2">Days beaten</th>
                  </tr>
                </thead>
                <tbody>
                  {beatenRows.map((row) => (
                    <tr key={row.projectId} className="border-b border-white/[0.04] text-slate-300">
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-2">
                          <AthleteAvatar
                            name={row.athleteName}
                            photoUrl={row.profilePhotoUrl}
                            backgroundColor={row.profilePhotoBgColor}
                            textTone={asAvatarTextTone(row.profilePhotoTextTone)}
                            size={24}
                          />
                          {row.athleteName}
                        </span>
                      </td>
                      <td className="px-3 py-2">{row.projectName}</td>
                      <td className="px-3 py-2">{row.clientName}</td>
                      <td className="px-3 py-2 tabular-nums">{row.completedDate}</td>
                      <td className="px-3 py-2 tabular-nums">{row.dueDate}</td>
                      <td className="px-3 py-2 tabular-nums font-medium text-emerald-300">
                        {row.daysBeaten}d early
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
