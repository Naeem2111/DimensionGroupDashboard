"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DueDateCalendar } from "@/components/ops/DueDateCalendar";
import { SimpleBarChart } from "@/components/ops/SimpleBarChart";
import { AthleteAvatar } from "@/components/ops/AthleteAvatar";
import { ClientAvatar } from "@/components/ops/ClientAvatar";
import { ProjectProgressBar } from "@/components/ProjectProgressBar";
import { asAvatarTextTone } from "@/lib/avatar-text-tone";
import type { OpsProjectPhase } from "@prisma/client";
import {
  displayProjectStageLabel,
  PROJECT_STATUS_LABELS,
} from "@/lib/ops-constants";

type ClientOption = {
  id: string;
  name: string;
  logoUrl: string | null;
  logoBgColor: string | null;
  logoTextTone: string | null;
};

type AthleteOption = {
  id: string;
  fullName: string;
  athleteCode: string;
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

type AnalyticsData = {
  month: string;
  clientFilter: string | null;
  athleteFilter: string | null;
  hoursByPhase: Array<{ phase: string; hours: number }>;
  hoursByClient: Array<{ clientId: string; clientName: string; clientLogoUrl: string | null; clientLogoBgColor: string | null; clientLogoTextTone: string | null; hours: number }>;
  hoursByAthlete: Array<{
    athleteId: string;
    athleteName: string;
    profilePhotoUrl: string | null;
    profilePhotoBgColor: string | null;
    profilePhotoTextTone: string | null;
    hours: number;
  }>;
  dueDateRisk: Array<{
    id: string;
    name: string;
    clientName: string;
    clientLogoUrl: string | null;
    clientLogoBgColor: string | null;
    clientLogoTextTone: string | null;
    dueDate: string;
    daysUntilDue: number;
    progressPercent: number;
    currentStatus: string;
    assignedAthleteName: string | null;
  }>;
  dueDateCalendar: Array<{
    id: string;
    name: string;
    clientName: string;
    clientLogoUrl: string | null;
    clientLogoBgColor: string | null;
    clientLogoTextTone: string | null;
    dueDate: string;
    progressPercent: number;
    currentStatus: string;
    assignedAthleteName: string | null;
  }>;
  profitabilityByClient: Array<{
    clientId: string;
    clientName: string;
    clientLogoUrl: string | null;
    clientLogoBgColor: string | null;
    clientLogoTextTone: string | null;
    revenueGbp: number;
    costGbp: number;
    marginGbp: number;
    marginPercent: number;
  }>;
  beatenDeadlinesByAthlete: BeatenDeadlinesByAthlete[];
};

function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function AnalyticsClient() {
  const [month, setMonth] = useState(currentMonth());
  const [clientId, setClientId] = useState("");
  const [athleteId, setAthleteId] = useState("");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([fetch("/api/ops/clients"), fetch("/api/ops/athletes")])
      .then(async ([cr, ar]) => {
        const cj = await cr.json();
        const aj = await ar.json();
        if (cj.clients) {
          setClients(
            cj.clients.map((c: { id: string; name: string; logoUrl?: string | null; logoBgColor?: string | null; logoTextTone?: string | null }) => ({
              id: c.id,
              name: c.name,
              logoUrl: c.logoUrl ?? null,
              logoBgColor: c.logoBgColor ?? null,
              logoTextTone: c.logoTextTone ?? null,
            }))
          );
        }
        if (aj.athletes) {
          setAthletes(
            aj.athletes.map((a: { id: string; fullName: string; athleteCode: string }) => ({
              id: a.id,
              fullName: a.fullName,
              athleteCode: a.athleteCode,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ month });
    if (clientId) q.set("clientId", clientId);
    if (athleteId) q.set("athleteId", athleteId);
    const r = await fetch(`/api/ops/analytics?${q}`);
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Failed to load");
      setLoading(false);
      return;
    }
    setData(j);
    setError("");
    setLoading(false);
  }, [month, clientId, athleteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId) ?? null,
    [clients, clientId]
  );

  const selectedAthlete = useMemo(
    () => athletes.find((a) => a.id === athleteId) ?? null,
    [athletes, athleteId]
  );

  const phaseBars = useMemo(
    () =>
      (data?.hoursByPhase ?? []).map((p) => ({
        label: displayProjectStageLabel(p.phase as OpsProjectPhase) ?? p.phase,
        value: p.hours,
        sublabel: `${p.hours}h`,
      })),
    [data]
  );

  const clientBars = useMemo(
    () =>
      (data?.hoursByClient ?? []).slice(0, 8).map((c) => ({
        label: c.clientName,
        value: c.hours,
        imageUrl: c.clientLogoUrl,
        imageBgColor: c.clientLogoBgColor,
        imageTextTone: c.clientLogoTextTone,
      })),
    [data]
  );

  const athleteBars = useMemo(
    () =>
      (data?.hoursByAthlete ?? []).map((a) => ({
        label: a.athleteName,
        value: a.hours,
        showAvatar: true,
        imageUrl: a.profilePhotoUrl,
        imageBgColor: a.profilePhotoBgColor,
        imageTextTone: a.profilePhotoTextTone,
        objectFit: "cover" as const,
      })),
    [data]
  );

  const beatenBars = useMemo(
    () =>
      (data?.beatenDeadlinesByAthlete ?? []).map((a) => ({
        label: a.athleteName,
        value: a.beatenCount,
        sublabel: `${a.totalDaysBeaten}d total · avg ${a.averageDaysBeaten}d`,
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

  if (loading && !data) return <p className="text-sm text-slate-500">Loading analytics…</p>;
  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!data) return null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-xs text-slate-400">
          Month
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mt-1 block rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="text-xs text-slate-400">
          Client / firm
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="select-console mt-1 block min-w-[14rem] rounded-md px-3 py-2 text-sm"
          >
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-400">
          Athlete
          <select
            value={athleteId}
            onChange={(e) => setAthleteId(e.target.value)}
            className="select-console mt-1 block min-w-[14rem] rounded-md px-3 py-2 text-sm"
          >
            <option value="">All athletes</option>
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.fullName}
              </option>
            ))}
          </select>
        </label>
        {selectedClient ? (
          <p className="flex items-center gap-2 pb-2 text-xs text-slate-400">
            <ClientAvatar
              name={selectedClient.name}
              logoUrl={selectedClient.logoUrl}
              backgroundColor={selectedClient.logoBgColor}
              textTone={asAvatarTextTone(selectedClient.logoTextTone)}
              size={22}
            />
            Filtering analytics to {selectedClient.name}
          </p>
        ) : null}
        {selectedAthlete ? (
          <p className="pb-2 text-xs text-slate-400">
            Filtering analytics to {selectedAthlete.fullName}
            <span className="block text-slate-500">{selectedAthlete.athleteCode}</span>
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card-tool rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white">Hours by phase</h2>
          <p className="mt-1 text-xs text-slate-500">
            {clientId || athleteId
              ? "Hours logged for the selected filters this month."
              : "All firms — cumulative phase hours this month."}
          </p>
          <div className="mt-4">
            <SimpleBarChart items={phaseBars} valueSuffix="h" />
          </div>
        </div>
        <div className="card-tool rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white">
            {clientId || athleteId ? "Hours this month" : "Hours by client"}
          </h2>
          <div className="mt-4">
            {clientBars.length === 0 ? (
              <p className="text-sm text-slate-500">No hours logged for this filter.</p>
            ) : (
              <SimpleBarChart items={clientBars} valueSuffix="h" />
            )}
          </div>
        </div>
        <div className="card-tool rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white">
            {athleteId ? "Athlete hours" : "Hours by athlete"}
          </h2>
          <div className="mt-4">
            <SimpleBarChart items={athleteBars} valueSuffix="h" />
          </div>
        </div>
        <div className="card-tool rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white">Profitability by client</h2>
          <div className="mt-4">
            <SimpleBarChart
              items={data.profitabilityByClient.slice(0, 8).map((c) => ({
                label: c.clientName,
                value: c.marginGbp,
                imageUrl: c.clientLogoUrl,
                imageBgColor: c.clientLogoBgColor,
                imageTextTone: c.clientLogoTextTone,
                sublabel: `${c.marginPercent}% margin · £${c.revenueGbp} rev`,
              }))}
              valueSuffix=""
            />
          </div>
        </div>
      </div>

      <div className="card-tool rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white">Beaten deadlines</h2>
        <p className="mt-1 text-xs text-slate-500">
          Projects completed before their due date in the selected month — useful for performance
          recognition and future bonus calculations.
        </p>
        {beatenBars.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No beaten deadlines in this period.</p>
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

      <div className="card-tool rounded-xl p-5 md:p-6">
        <h2 className="text-base font-semibold text-white">Due date calendar</h2>
        <p className="mt-1.5 text-sm text-slate-500">
          Active projects due in the selected month — progress bars show completion.
        </p>
        <div className="mt-5">
          <DueDateCalendar month={month} projects={data.dueDateCalendar ?? []} />
        </div>
      </div>

      <div className="card-tool rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white">Due date risk</h2>
        <p className="mt-1 text-xs text-slate-500">Projects due within 14 days that are not complete.</p>
        {data.dueDateRisk.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No at-risk projects.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-xs uppercase text-slate-500">
                  <th className="px-3 py-2">Project</th>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Due</th>
                  <th className="px-3 py-2">Days</th>
                  <th className="px-3 py-2 min-w-[120px]">Progress</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Athlete</th>
                </tr>
              </thead>
              <tbody>
                {data.dueDateRisk.map((p) => (
                  <tr key={p.id} className="border-b border-white/[0.04] text-slate-300">
                    <td className="px-3 py-2">{p.name}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-2">
                        <ClientAvatar
                          name={p.clientName}
                          logoUrl={p.clientLogoUrl}
                          backgroundColor={p.clientLogoBgColor}
                          textTone={asAvatarTextTone(p.clientLogoTextTone)}
                          size={24}
                        />
                        {p.clientName}
                      </span>
                    </td>
                    <td className="px-3 py-2">{p.dueDate}</td>
                    <td
                      className={`px-3 py-2 tabular-nums ${p.daysUntilDue < 0 ? "text-red-300" : p.daysUntilDue <= 3 ? "text-amber-300" : ""}`}
                    >
                      {p.daysUntilDue < 0 ? `${Math.abs(p.daysUntilDue)}d overdue` : `${p.daysUntilDue}d`}
                    </td>
                    <td className="px-3 py-2">
                      <ProjectProgressBar percent={p.progressPercent} showLabel />
                    </td>
                    <td className="px-3 py-2">
                      {PROJECT_STATUS_LABELS[p.currentStatus as keyof typeof PROJECT_STATUS_LABELS] ?? p.currentStatus}
                    </td>
                    <td className="px-3 py-2">{p.assignedAthleteName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
