"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LeadStageTag } from "@/components/LeadStageTag";
import { FollowUpTimeTag } from "@/components/FollowUpTimeTag";
import type { MarketingNotificationItem } from "@/lib/lead-outreach";
import { LEAD_STAGE_COLORS, followUpStatusLabel } from "@/lib/lead-stage-ui";

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function MarketingNotificationsClient() {
  const [items, setItems] = useState<MarketingNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/marketing/notifications")
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-400">
        Follow-ups due today or overdue for architecture practices. Separate from athlete and project notifications.
      </p>

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <div className="card-tool rounded-2xl p-8 text-center ring-1 ring-white/[0.06]">
          <p className="text-slate-300">No follow-ups due right now.</p>
          <p className="mt-1 text-sm text-slate-500">Log outreach with a follow-up date to get reminders here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const color = LEAD_STAGE_COLORS[item.effectiveStage] ?? "#dc2626";
            return (
              <article
                key={item.practiceUrl}
                className="card-tool flex flex-wrap items-start justify-between gap-4 rounded-2xl p-4 ring-1 ring-white/[0.06]"
                style={{ borderLeft: `3px solid ${color}` }}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-white">{item.practiceName}</h2>
                    <LeadStageTag stage={item.effectiveStage} />
                    <FollowUpTimeTag followUpDueAt={item.followUpDueAt} />
                  </div>
                  <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="text-slate-500">Last contacted</dt>
                      <dd className="text-slate-300">{formatDate(item.lastContactedAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Follow-up due</dt>
                      <dd className="text-slate-300">{formatDate(item.followUpDueAt)}</dd>
                    </div>
                  </dl>
                  {item.nextAction ? (
                    <p className="mt-2 text-xs text-brand-300">Next: {item.nextAction}</p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span
                    className="rounded-lg px-2.5 py-1 text-xs font-bold uppercase"
                    style={{
                      color: item.followUpStatus === "overdue" ? "#dc2626" : "#f59e0b",
                      backgroundColor: item.followUpStatus === "overdue" ? "#dc262618" : "#f59e0b18",
                    }}
                  >
                    {item.followUpStatus === "overdue"
                      ? `${item.daysOverdue} day${item.daysOverdue === 1 ? "" : "s"} overdue`
                      : followUpStatusLabel(item.followUpStatus)}
                  </span>
                  <Link
                    href={`/dashboard/practices/${encodeURIComponent(item.practiceSlug)}`}
                    className="btn-brand-primary rounded-lg px-3 py-1.5 text-sm"
                  >
                    Open outreach log
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
