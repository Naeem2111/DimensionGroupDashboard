"use client";

type Props = {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  label?: string;
};

function progressColor(pct: number): string {
  if (pct < 34) return "#ef4444";
  if (pct < 67) return "#f97316";
  return "#22c55e";
}

export function ProgressSlider({ value, onChange, disabled, label = "Project progress" }: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const color = progressColor(clamped);

  return (
    <div className={disabled ? "opacity-60" : ""}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-400">{label}</span>
        <span className="text-xs font-semibold tabular-nums" style={{ color }}>
          {clamped}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        disabled={disabled}
        value={clamped}
        onChange={(e) => onChange(Number(e.target.value))}
        className="progress-slider mt-2 w-full"
        style={
          {
            ["--progress-pct" as string]: `${clamped}%`,
            ["--progress-color" as string]: color,
          } as React.CSSProperties
        }
      />
      <div className="mt-1 flex justify-between text-[10px] text-slate-600">
        <span>Low</span>
        <span>Medium</span>
        <span>High</span>
      </div>
    </div>
  );
}
