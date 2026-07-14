"use client";

import { useMemo } from "react";
import { ClientAvatar } from "@/components/ops/ClientAvatar";
import { ProjectProgressBar } from "@/components/ProjectProgressBar";
import { asAvatarTextTone } from "@/lib/avatar-text-tone";

type CalendarProject = {
  id: string;
  name: string;
  clientName: string;
  clientLogoUrl?: string | null;
  clientLogoBgColor?: string | null;
  clientLogoTextTone?: string | null;
  dueDate: string;
  progressPercent: number;
  assignedAthleteName: string | null;
};

function parseMonth(month: string): { year: number; monthIndex: number } {
  const [y, m] = month.split("-").map(Number);
  return { year: y ?? new Date().getFullYear(), monthIndex: (m ?? 1) - 1 };
}

export function DueDateCalendar({
  month,
  projects,
}: {
  month: string;
  projects: CalendarProject[];
}) {
  const { year, monthIndex } = parseMonth(month);
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;

  const byDay = useMemo(() => {
    const map = new Map<number, CalendarProject[]>();
    for (const p of projects) {
      const d = new Date(`${p.dueDate}T12:00:00`);
      if (d.getFullYear() !== year || d.getMonth() !== monthIndex) continue;
      const day = d.getDate();
      const list = map.get(day) ?? [];
      list.push(p);
      map.set(day, list);
    }
    return map;
  }, [projects, year, monthIndex]);

  const cells: Array<{ day: number | null }> = [];
  for (let i = 0; i < startOffset; i++) cells.push({ day: null });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d });
  while (cells.length % 7 !== 0) cells.push({ day: null });

  const monthLabel = firstDay.toLocaleString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="due-date-calendar">
      <h3 className="text-base font-semibold text-white">{monthLabel}</h3>
      <div className="mt-4 overflow-x-auto">
        <div className="due-date-calendar-grid grid min-w-[42rem] grid-cols-7 gap-1 overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.04] text-sm sm:min-w-0">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="due-date-calendar-head px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 sm:text-sm sm:normal-case sm:tracking-normal">
            {d}
          </div>
        ))}
        {cells.map((cell, i) => {
          const items = cell.day ? byDay.get(cell.day) ?? [] : [];
          return (
            <div
              key={i}
              className={`due-date-calendar-cell min-h-[7.5rem] p-2 sm:min-h-[8.5rem] sm:p-2.5 ${cell.day ? "" : "due-date-calendar-cell-empty"}`}
            >
              {cell.day ? (
                <>
                  <span className="due-date-calendar-day-num text-sm font-semibold tabular-nums text-slate-300">
                    {cell.day}
                  </span>
                  <ul className="mt-1.5 space-y-1.5">
                    {items.map((p) => (
                      <li
                        key={p.id}
                        className="due-date-calendar-event rounded-md bg-white/[0.04] px-1.5 py-1"
                        title={`${p.name} · ${p.clientName}`}
                      >
                        <p className="due-date-calendar-event-title flex items-center gap-1.5 text-xs font-medium leading-snug text-slate-200">
                          {p.clientLogoUrl || p.clientLogoBgColor ? (
                            <ClientAvatar
                              name={p.clientName}
                              logoUrl={p.clientLogoUrl}
                              backgroundColor={p.clientLogoBgColor}
                              textTone={asAvatarTextTone(p.clientLogoTextTone)}
                              size={18}
                            />
                          ) : null}
                          <span className="line-clamp-2 min-w-0 flex-1">{p.name}</span>
                        </p>
                        <div className="mt-1 [&_.progress-track]:h-2.5">
                          <ProjectProgressBar percent={p.progressPercent} showLabel={false} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
