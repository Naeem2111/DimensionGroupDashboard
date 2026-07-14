"use client";

/** Muted progress bar per V2 spec: grey → red → orange → yellow → green → Blocharch blue @ 100%. */
export function progressBarColor(percent: number): string {
  const p = Math.max(0, Math.min(100, percent));
  if (p === 0) return "rgb(100 116 139 / 0.35)";
  if (p >= 100) return "#3b82f6";
  if (p >= 80) return "rgb(34 197 94 / 0.85)";
  if (p >= 60) return "rgb(234 179 8 / 0.85)";
  if (p >= 40) return "rgb(249 115 22 / 0.85)";
  return "rgb(239 68 68 / 0.85)";
}

export function ProjectProgressBar({
  percent,
  showLabel = true,
  className = "",
}: {
  percent: number | null | undefined;
  showLabel?: boolean;
  className?: string;
}) {
  const p = percent == null ? 0 : Math.max(0, Math.min(100, percent));
  const fill = progressBarColor(p);

  return (
    <div className={`space-y-1 ${className}`}>
      {showLabel ? (
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>Progress</span>
          <span className="tabular-nums text-slate-400">{p}%</span>
        </div>
      ) : null}
      <div
        className="progress-track h-2 w-full overflow-hidden rounded-full bg-white/[0.06]"
        role="progressbar"
        aria-valuenow={p}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${p}%`, backgroundColor: fill }}
        />
      </div>
    </div>
  );
}
