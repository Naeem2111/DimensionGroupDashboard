"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AddPracticeForm } from "@/components/practices/AddPracticeForm";
import { FollowUpTimeTag } from "@/components/FollowUpTimeTag";
import { LeadStageTag } from "@/components/LeadStageTag";
import { LEAD_FILTER_OPTIONS, followUpStatusColor, followUpStatusLabel } from "@/lib/lead-stage-ui";
import { LeadStagePicker } from "@/components/LeadStagePicker";
import { isManualPracticeUrl } from "@/lib/practice-url";

interface LeadItem {
  url: string;
  name: string;
  email: string;
  contact: string;
  slug: string;
  lead: {
    stage: string;
    effectiveStage: string;
    rating: number;
    notes?: string;
    lastEmailedAt?: string;
    lastContactedAt?: string;
    followUpDueAt?: string;
    followUpStatus: string;
    lastCommunicationType?: string;
    touchCount: number;
    nextAction?: string;
  };
}

function slugFromUrl(url: string): string {
  const m = url.match(/\/practice\/([^/]+)\/?$/);
  return m ? m[1] : "";
}

function formatDate(iso?: string): string {
  if (!iso?.trim()) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(value === n ? 0 : n)}
          className={`rounded p-0.5 transition-colors ${
            disabled ? "cursor-not-allowed opacity-60" : "hover:scale-110"
          } ${value >= n ? "text-amber-400" : "text-slate-600"}`}
          aria-label={`Rate ${n} stars`}
        >
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

export function AutomationClient() {
  const [stage, setStage] = useState<string>("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: LeadItem[]; total: number; totalPages: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("perPage", "25");
    if (stage) params.set("stage", stage);
    if (query) params.set("q", query);
    params.set("withEmail", "true");
    return fetch(`/api/leads?${params}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [stage, page, query]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  async function updateLead(practiceUrl: string, updates: { stage?: string; rating?: number }) {
    const slug = slugFromUrl(practiceUrl);
    const res = await fetch(`/api/leads/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) return;
    const d = await res.json().catch(() => null);
    if (data && d) {
      setData({
        ...data,
        items: data.items.map((item) =>
          item.url === practiceUrl
            ? {
                ...item,
                lead: {
                  ...item.lead,
                  stage: d.stage ?? item.lead.stage,
                  effectiveStage: d.outreach?.effectiveStage ?? d.stage ?? item.lead.effectiveStage,
                  rating: d.rating ?? item.lead.rating,
                  followUpDueAt: d.followUpDueAt ?? item.lead.followUpDueAt,
                  followUpStatus: d.outreach?.followUpStatus ?? item.lead.followUpStatus,
                },
              }
            : item
        ),
      });
    }
  }

  return (
    <div className="space-y-8">
      <AddPracticeForm
        onCreated={() => {
          setPage(1);
          setRefreshKey((k) => k + 1);
        }}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setQuery(q);
              setPage(1);
            }
          }}
          placeholder="Search by name, email, contact, address..."
          className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-white placeholder-slate-500 ring-1 ring-black/20 focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        />
        <button
          type="button"
          onClick={() => {
            setQuery(q);
            setPage(1);
          }}
          className="rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-brand/25 transition-opacity hover:opacity-95"
        >
          Search
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Filter:</span>
          <select
            value={stage}
            onChange={(e) => {
              setStage(e.target.value);
              setPage(1);
            }}
            className="select-console rounded-lg px-3 py-2 text-sm"
          >
            {LEAD_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <Link
          href="/dashboard/marketing/notifications"
          className="rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-sm font-medium text-brand-200 hover:bg-brand-500/15"
        >
          Marketing notifications
        </Link>
      </div>

      <p className="text-sm text-slate-500">
        Track outreach stages, follow-up dates, and contact history. Open a practice to log emails, replies, and next actions.
      </p>

      {loading ? (
        <p className="py-8 text-slate-400">Loading…</p>
      ) : data ? (
        <>
          <p className="text-sm text-slate-500">
            {data.total} practice{data.total !== 1 ? "s" : ""} with email
            {query ? ` matching “${query}”` : ""}
          </p>
          <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-white/[0.02] ring-1 ring-white/[0.04]">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr className="bg-white/[0.04] text-left text-sm text-slate-400">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Stage</th>
                  <th className="px-4 py-3 font-medium">Rating</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">Last contacted</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">Next follow-up</th>
                  <th className="px-4 py-3 font-medium">Follow-up</th>
                  <th className="px-4 py-3 font-medium">Last type</th>
                  <th className="px-4 py-3 font-medium">Touches</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {data.items.map((item) => (
                  <tr key={item.url} className="transition-colors hover:bg-white/[0.03]">
                    <td className="min-w-[14rem] px-4 py-3">
                      <Link
                        href={`/dashboard/practices/${encodeURIComponent(item.slug)}`}
                        className="text-sm font-semibold text-white hover:text-brand-400"
                      >
                        {item.name || "—"}
                      </Link>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <LeadStageTag
                          stage={item.lead.effectiveStage || item.lead.stage}
                          compact
                        />
                        <FollowUpTimeTag followUpDueAt={item.lead.followUpDueAt} compact />
                        {isManualPracticeUrl(item.url) ? (
                          <span className="rounded bg-white/[0.06] px-2 py-0.5 text-xs uppercase tracking-wide text-slate-500">
                            Manual
                          </span>
                        ) : null}
                      </div>
                      {item.lead.nextAction ? (
                        <p className="mt-2 text-xs text-slate-400" title={item.lead.nextAction}>
                          {item.lead.nextAction}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <LeadStagePicker
                        value={item.lead.effectiveStage || item.lead.stage}
                        onChange={(s) => updateLead(item.url, { stage: s })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <StarRating
                        value={item.lead.rating}
                        onChange={(v) => updateLead(item.url, { rating: v })}
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">
                      {formatDate(item.lead.lastContactedAt || item.lead.lastEmailedAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">
                      {formatDate(item.lead.followUpDueAt)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {item.lead.followUpStatus && item.lead.followUpStatus !== "none" ? (
                        <span
                          className="rounded px-1.5 py-0.5 font-semibold uppercase"
                          style={{
                            color: followUpStatusColor(item.lead.followUpStatus),
                            backgroundColor: `${followUpStatusColor(item.lead.followUpStatus)}18`,
                          }}
                        >
                          {followUpStatusLabel(item.lead.followUpStatus)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {item.lead.lastCommunicationType || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-slate-300">{item.lead.touchCount ?? 0}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/practices/${encodeURIComponent(item.slug)}`}
                        className="text-sm text-brand-400 hover:text-brand-300"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.totalPages > 1 && (
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded border border-white/[0.08] bg-white/[0.06] px-3 py-1.5 text-sm text-slate-300 ring-1 ring-white/[0.04] transition-colors hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-slate-400">
                Page {page} of {data.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="rounded border border-white/[0.08] bg-white/[0.06] px-3 py-1.5 text-sm text-slate-300 ring-1 ring-white/[0.04] transition-colors hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
