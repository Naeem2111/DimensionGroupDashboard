"use client";

import { LEAD_STAGES, type LeadStage } from "@/lib/leads";
import { LEAD_STAGE_COLORS, LEAD_STAGE_LABELS } from "@/lib/lead-stage-ui";

type Props = {
  value: string;
  onChange: (stage: LeadStage) => void;
  className?: string;
};

export function LeadStagePicker({ value, onChange, className = "" }: Props) {
  const stage = LEAD_STAGES.includes(value as LeadStage) ? (value as LeadStage) : "cold";
  const color = LEAD_STAGE_COLORS[stage];

  return (
    <div className={`relative inline-flex min-w-[11rem] items-center ${className}`}>
      <span
        className="pointer-events-none absolute left-2.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full ring-2 ring-white/10"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <select
        value={stage}
        onChange={(e) => onChange(e.target.value as LeadStage)}
        className="select-console w-full rounded-lg py-1.5 pl-8 pr-2 text-sm"
        style={{ borderLeft: `3px solid ${color}` }}
      >
        {LEAD_STAGES.map((s) => (
          <option key={s} value={s}>
            {LEAD_STAGE_LABELS[s]}
          </option>
        ))}
      </select>
    </div>
  );
}
