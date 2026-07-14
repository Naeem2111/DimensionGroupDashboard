"use client";

import { ClientAvatar } from "@/components/ops/ClientAvatar";
import { asAvatarTextTone } from "@/lib/avatar-text-tone";

type BarItem = {
  label: string;
  value: number;
  sublabel?: string;
  imageUrl?: string | null;
  imageBgColor?: string | null;
  imageTextTone?: string | null;
  /** When true, show initials avatar even without a photo URL. */
  showAvatar?: boolean;
  objectFit?: "contain" | "cover";
};

type SimpleBarChartProps = {
  items: BarItem[];
  valueSuffix?: string;
  maxValue?: number;
};

export function SimpleBarChart({ items, valueSuffix = "", maxValue }: SimpleBarChartProps) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">No data for this period.</p>;
  }

  const max = maxValue ?? Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const pct = Math.max(4, (item.value / max) * 100);
        return (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-2 truncate text-slate-300">
                {item.showAvatar || item.imageUrl || item.imageBgColor ? (
                  <ClientAvatar
                    name={item.label}
                    logoUrl={item.imageUrl}
                    backgroundColor={item.imageBgColor}
                    textTone={asAvatarTextTone(item.imageTextTone)}
                    size={22}
                    objectFit={item.objectFit ?? "contain"}
                  />
                ) : null}
                <span className="truncate">{item.label}</span>
              </span>
              <span className="shrink-0 tabular-nums text-slate-400">
                {item.value.toFixed(1)}
                {valueSuffix}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06] chart-bar-track">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400"
                style={{ width: `${pct}%` }}
              />
            </div>
            {item.sublabel ? <p className="mt-0.5 text-[10px] text-slate-500">{item.sublabel}</p> : null}
          </div>
        );
      })}
    </div>
  );
}
