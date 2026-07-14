"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AthleteAvatar } from "@/components/ops/AthleteAvatar";
import { ClientAvatar } from "@/components/ops/ClientAvatar";
import { asAvatarTextTone } from "@/lib/avatar-text-tone";
import { PROJECT_PHASE_LABELS, TASK_TYPE_LABELS } from "@/lib/ops-constants";

type LineItem = {
  projectName: string;
  clientName: string;
  clientLogoUrl: string | null;
  clientLogoBgColor: string | null;
  clientLogoTextTone: string | null;
  projectPhase: string;
  taskType: string;
  taskTypes?: string[];
  hoursWorked: number;
  completionPercent: number | null;
  blockerFlag: boolean;
  blockerNote: string | null;
  completedSummary: string | null;
  notes: string | null;
};

type Submission = {
  id: string;
  athleteName: string;
  athleteCode: string;
  profilePhotoUrl: string | null;
  profilePhotoBgColor: string | null;
  profilePhotoTextTone: string | null;
  submissionDate: string;
  totalHours: number;
  wellbeingScore: number | null;
  checkInRequested: boolean;
  checkInNeedsAction: boolean;
  dailyNote: string | null;
  lockedAt: string | null;
  lineItems: LineItem[];
};

function taskTypeLabel(li: LineItem): string {
  const types = li.taskTypes?.length ? li.taskTypes : [li.taskType];
  return types
    .map((t) => TASK_TYPE_LABELS[t as keyof typeof TASK_TYPE_LABELS] ?? t)
    .join(", ");
}

export function OpsSubmissionsClient() {
  const [rows, setRows] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingCheckIns, setPendingCheckIns] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const [sr, br] = await Promise.all([
      fetch("/api/ops/submissions?limit=200"),
      fetch("/api/ops/sidebar-badges"),
    ]);
    const j = await sr.json();
    const bj = await br.json().catch(() => ({}));
    if (!sr.ok) {
      setError(j.error || "Failed to load");
      setLoading(false);
      return;
    }
    setRows(j.submissions || []);
    setPendingCheckIns(bj.checkIns ?? 0);
    setError("");
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (loading) return <p className="text-sm text-slate-500">Loading submissions…</p>;
  if (error) return <p className="text-sm text-red-400">{error}</p>;

  const actionCount = rows.filter((s) => s.checkInNeedsAction).length;

  return (
    <div className="space-y-4">
      {pendingCheckIns > 0 ? (
        <div
          className="ops-alert-banner animate-pulse rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 ring-1 ring-red-500/35"
          role="status"
        >
          <p className="text-sm font-semibold text-red-100">
            {pendingCheckIns} check-in request{pendingCheckIns === 1 ? "" : "s"} need action
          </p>
          <p className="mt-1 text-xs text-red-200/90">
            {actionCount > 0
              ? `${actionCount} submission${actionCount === 1 ? "" : "s"} below flagged in red.`
              : "Open Check-in requests to schedule or respond."}{" "}
            <Link href="/dashboard/ops/check-ins" className="font-medium underline hover:text-red-100">
              Go to Check-in requests →
            </Link>
          </p>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No daily submissions logged yet.</p>
      ) : (
        rows.map((s) => (
          <article
            key={s.id}
            className={`rounded-xl p-5 ${
              s.checkInNeedsAction
                ? "ops-checkin-alert animate-pulse border border-red-500/40 bg-red-500/[0.06] ring-1 ring-red-500/35"
                : "card-tool"
            }`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex items-center gap-3">
                <AthleteAvatar
                  name={s.athleteName}
                  photoUrl={s.profilePhotoUrl}
                  backgroundColor={s.profilePhotoBgColor}
                  textTone={asAvatarTextTone(s.profilePhotoTextTone)}
                  size={36}
                />
                <div>
                <h2 className="text-sm font-semibold text-white">
                  {s.athleteName}{" "}
                  <span className="font-normal text-slate-500">({s.athleteCode})</span>
                </h2>
                <p className="text-xs text-slate-500">{s.submissionDate}</p>
                </div>
              </div>
              <p className="text-sm font-medium tabular-nums text-brand-300">{s.totalHours.toFixed(2)}h total</p>
            </div>
            {s.checkInNeedsAction ? (
              <p className="ops-checkin-alert-text mt-2 text-xs font-semibold text-red-200">
                Check-in requested — action required in{" "}
                <Link href="/dashboard/ops/check-ins" className="underline hover:text-red-100">
                  Check-in requests
                </Link>
              </p>
            ) : s.checkInRequested ? (
              <p className="mt-2 text-xs text-slate-500">Check-in requested (scheduled)</p>
            ) : null}
            {s.dailyNote ? <p className="mt-2 text-sm text-slate-400">{s.dailyNote}</p> : null}
            <ul className="mt-4 space-y-3 border-t border-white/[0.06] pt-4">
              {s.lineItems.map((li, i) => {
                const types = li.taskTypes?.length ? li.taskTypes : [li.taskType];
                const hasOther = types.includes("other");
                return (
                <li key={i} className="text-sm">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-slate-200">
                    <ClientAvatar
                      name={li.clientName}
                      logoUrl={li.clientLogoUrl}
                      backgroundColor={li.clientLogoBgColor}
                      textTone={asAvatarTextTone(li.clientLogoTextTone)}
                      size={22}
                    />
                    <span>{li.clientName}</span>
                    <span className="text-slate-500">—</span>
                    <span>{li.projectName}</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {PROJECT_PHASE_LABELS[li.projectPhase as keyof typeof PROJECT_PHASE_LABELS] ?? li.projectPhase}{" "}
                    · {taskTypeLabel(li)} · {li.hoursWorked}h
                    {li.completionPercent != null ? ` · ${li.completionPercent}% progress` : ""}
                  </p>
                  {hasOther && li.notes ? (
                    <p className="ops-other-note mt-1 text-xs text-brand-200/90">
                      Other: {li.notes}
                    </p>
                  ) : hasOther ? (
                    <p className="ops-warning-text mt-1 text-xs text-amber-300">Other task type — no explanation provided</p>
                  ) : null}
                  {li.completedSummary ? (
                    <p className="mt-1 text-xs text-slate-400">{li.completedSummary}</p>
                  ) : null}
                  {li.blockerFlag ? (
                    <p className="ops-blocker-text mt-1 text-xs text-red-300">
                      Blocker{li.blockerNote ? `: ${li.blockerNote}` : ""}
                    </p>
                  ) : null}
                </li>
                );
              })}
            </ul>
          </article>
        ))
      )}
    </div>
  );
}

