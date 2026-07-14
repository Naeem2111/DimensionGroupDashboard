"use client";

import { useState, useEffect } from "react";
import { LEAD_STAGES } from "@/lib/leads";
import { LEAD_STAGE_LABELS } from "@/lib/lead-stage-ui";
import { PRACTICE_SOFTWARE_OPTIONS } from "@/lib/practice-software";

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
          onClick={() => onChange(n)}
          className={`p-0.5 rounded transition-colors ${
            disabled ? "cursor-not-allowed opacity-60" : "hover:scale-110"
          } ${value >= n ? "text-amber-400" : "text-slate-600"}`}
          aria-label={`Rate ${n} stars`}
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

function formatEmailedAt(iso?: string): string {
  if (!iso?.trim()) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function LeadStatus({ slug }: { slug: string }) {
  const [stage, setStage] = useState("");
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState("");
  const [software, setSoftware] = useState("");
  const [softwareOther, setSoftwareOther] = useState("");
  const [lastEmailedAt, setLastEmailedAt] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/leads/${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => {
        setStage(d.stage || "cold");
        setRating(d.rating ?? 0);
        setNotes(d.notes || "");
        setSoftware(d.software || "");
        setSoftwareOther(d.softwareOther || "");
        setLastEmailedAt(d.lastEmailedAt || undefined);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  async function update(updates: {
    stage?: string;
    rating?: number;
    notes?: string;
    software?: string;
    softwareOther?: string;
  }) {
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const d = await res.json();
        if (d.stage !== undefined) setStage(d.stage);
        if (d.rating !== undefined) setRating(d.rating);
        if (d.notes !== undefined) setNotes(d.notes);
        if (d.software !== undefined) setSoftware(d.software || "");
        if (d.softwareOther !== undefined) setSoftwareOther(d.softwareOther || "");
        if (d.lastEmailedAt !== undefined) setLastEmailedAt(d.lastEmailedAt || undefined);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-slate-500 text-sm">Loading…</p>;

  return (
    <div className="space-y-4">
      <p className="text-slate-500 text-xs leading-relaxed">
        Track pipeline stage, rating, software, and notes for this practice. Changes are saved to the database.
      </p>
      {lastEmailedAt ? (
        <div>
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">Last contact</p>
          <p className="text-slate-200 text-sm">{formatEmailedAt(lastEmailedAt)}</p>
        </div>
      ) : null}
      <div>
        <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">Pipeline stage</p>
        <select
          value={stage}
          onChange={(e) => update({ stage: e.target.value })}
          disabled={saving}
          className="select-console px-3 py-2 rounded-lg text-sm w-full"
        >
          {LEAD_STAGES.map((s) => (
            <option key={s} value={s}>
              {LEAD_STAGE_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">Rating</p>
        <StarRating value={rating} onChange={(v) => update({ rating: v })} disabled={saving} />
      </div>
      <div>
        <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">Software</p>
        <select
          value={software}
          onChange={(e) => {
            const next = e.target.value;
            setSoftware(next);
            if (next !== "other") {
              setSoftwareOther("");
              void update({ software: next, softwareOther: "" });
            } else {
              void update({ software: next });
            }
          }}
          disabled={saving}
          className="select-console px-3 py-2 rounded-lg text-sm w-full"
        >
          <option value="">Not set</option>
          {PRACTICE_SOFTWARE_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        {software === "other" ? (
          <input
            value={softwareOther}
            onChange={(e) => setSoftwareOther(e.target.value)}
            onBlur={() => update({ software: "other", softwareOther })}
            disabled={saving}
            placeholder="Specify software"
            className="mt-2 w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm"
          />
        ) : null}
      </div>
      <div>
        <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">Notes</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => update({ notes })}
          disabled={saving}
          rows={5}
          className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm resize-none"
          placeholder="Call notes, context, next steps…"
        />
      </div>
    </div>
  );
}
