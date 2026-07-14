"use client";

import { useMemo } from "react";

export type CalendarMark = {
  date: string;
  label?: string;
  color?: string;
};

function parseMonth(month: string): { year: number; monthIndex: number } {
  const [y, m] = month.split("-").map(Number);
  return { year: y ?? new Date().getFullYear(), monthIndex: (m ?? 1) - 1 };
}

export function MiniMonthCalendar({
  month,
  marks = [],
  selectedDate,
  onSelectDate,
  className = "",
}: {
  month: string;
  marks?: CalendarMark[];
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
  className?: string;
}) {
  const { year, monthIndex } = parseMonth(month);
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;

  const markByDay = useMemo(() => {
    const map = new Map<number, CalendarMark[]>();
    for (const m of marks) {
      const d = new Date(`${m.date}T12:00:00`);
      if (d.getFullYear() !== year || d.getMonth() !== monthIndex) continue;
      const day = d.getDate();
      const list = map.get(day) ?? [];
      list.push(m);
      map.set(day, list);
    }
    return map;
  }, [marks, year, monthIndex]);

  const cells: Array<number | null> = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthLabel = firstDay.toLocaleString("en-GB", { month: "long", year: "numeric" });
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className={`mini-month-calendar ${className}`}>
      <p className="mini-calendar-title text-xs font-medium text-slate-400">{monthLabel}</p>
      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[10px]">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={`${d}-${i}`} className="mini-calendar-weekday py-1 font-medium text-slate-600">
            {d}
          </span>
        ))}
        {cells.map((day, i) => {
          if (day == null) return <span key={`e-${i}`} />;
          const iso = `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
          const dayMarks = markByDay.get(day) ?? [];
          const isSelected = selectedDate === iso;
          const clickable = !!onSelectDate;
          const Tag = clickable ? "button" : "div";
          return (
            <Tag
              key={iso}
              type={clickable ? "button" : undefined}
              onClick={clickable ? () => onSelectDate!(iso) : undefined}
              title={dayMarks.map((m) => m.label).filter(Boolean).join(", ") || undefined}
              className={`mini-calendar-day relative rounded-md py-1.5 tabular-nums transition-colors ${
                isSelected
                  ? "mini-calendar-day-selected bg-brand-500/25 font-semibold text-brand-100 ring-1 ring-brand-500/40"
                  : clickable
                    ? "text-slate-300 hover:bg-white/[0.06]"
                    : "text-slate-400"
              }`}
            >
              {day}
              {dayMarks.length > 0 ? (
                <span className="absolute bottom-0.5 left-1/2 flex -translate-x-1/2 gap-0.5">
                  {dayMarks.slice(0, 3).map((m, j) => (
                    <span
                      key={j}
                      className="h-1 w-1 rounded-full"
                      style={{ backgroundColor: m.color ?? "#3b82f6" }}
                    />
                  ))}
                </span>
              ) : null}
            </Tag>
          );
        })}
      </div>
    </div>
  );
}
