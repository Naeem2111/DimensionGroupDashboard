"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ClientPortalBrandMark } from "@/components/client-portal/ClientPortalBrandMark";
import { ClientAvatar } from "@/components/ops/ClientAvatar";
import { AthleteAvatar } from "@/components/ops/AthleteAvatar";
import { MiniMonthCalendar } from "@/components/MiniMonthCalendar";
import { ProjectProgressBar } from "@/components/ProjectProgressBar";
import { asAvatarTextTone } from "@/lib/avatar-text-tone";
import { clientPortalPath } from "@/lib/client-slug";
import { daysUntilDueFromIso, projectDueColor } from "@/lib/project-color-scale";
import { computeProjectTimeline } from "@/lib/project-timeline";
import { PublicThemeToggle } from "@/components/client-portal/PublicThemeToggle";
import type { PublicClientPortalData, PublicClientPortalProject } from "@/lib/public-client-portal";

type Tab = "tracker" | "completed";

function formatShortDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function formatDateRange(start: string | null, due: string | null): string | null {
  if (start && due) return `${formatShortDate(start)} – ${formatShortDate(due)}`;
  if (due) return `Due ${formatShortDate(due)}`;
  if (start) return `From ${formatShortDate(start)}`;
  return null;
}

function ProjectCard({ project, showTasks }: { project: PublicClientPortalProject; showTasks?: boolean }) {
  const timeline = computeProjectTimeline({
    startDate: project.startDate,
    dueDate: project.dueDate,
    handoverDate: project.handoverDate,
  });
  const accent = projectDueColor(daysUntilDueFromIso(project.dueDate));
  const [tasksOpen, setTasksOpen] = useState(false);

  return (
    <article
      className="client-portal-card relative rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5"
      style={{ borderLeftWidth: 3, borderLeftColor: accent }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-white sm:text-lg">{project.name}</h3>
        </div>
        <span
          className="client-portal-status-badge inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide"
          style={{
            backgroundColor: `${project.statusBadge.color}28`,
            color: project.statusBadge.color,
            borderColor: `${project.statusBadge.color}40`,
          }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: project.statusBadge.color }} />
          {project.statusBadge.label}
        </span>
      </div>

      <p className="mt-2 text-xs text-slate-400">
        Stage: {project.currentStageLabel}
        {timeline.label ? ` · ${timeline.label}` : ""}
      </p>
      {formatDateRange(project.startDate, project.dueDate) ? (
        <p className="mt-1 text-xs text-slate-500">{formatDateRange(project.startDate, project.dueDate)}</p>
      ) : null}

      <div className="mt-4">
        <ProjectProgressBar percent={project.progressPercent} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {project.leadName ? (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Office lead</span>
            <AthleteAvatar
              name={project.leadName}
              photoUrl={project.leadPhotoUrl}
              backgroundColor={project.leadPhotoBgColor}
              textTone={asAvatarTextTone(project.leadPhotoTextTone)}
              size={28}
            />
            <span className="text-sm text-slate-300">{project.leadName}</span>
          </div>
        ) : (
          <span className="text-xs text-slate-500">Office lead assigned soon</span>
        )}
      </div>

      {showTasks && project.openTasks.length > 0 ? (
        <div className="mt-4 border-t border-white/[0.06] pt-3">
          <button
            type="button"
            onClick={() => setTasksOpen((v) => !v)}
            className="text-xs font-medium text-brand-300 hover:text-brand-200"
          >
            {tasksOpen ? "Hide" : "Show"} open tasks ({project.openTasks.length})
          </button>
          {tasksOpen ? (
            <ul className="mt-2 space-y-2">
              {project.openTasks.map((task) => (
                <li key={task.id} className="client-portal-task rounded-lg bg-white/[0.03] px-3 py-2 text-xs">
                  <p className="font-medium text-slate-200">{task.title}</p>
                  <p className="text-slate-500">{task.columnTitle}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function CompletedRow({ project }: { project: PublicClientPortalProject }) {
  const accent = projectDueColor(daysUntilDueFromIso(project.dueDate));
  const outcome =
    project.deadlineBeatenDays != null && project.deadlineBeatenDays > 0
      ? `${project.deadlineBeatenDays} day${project.deadlineBeatenDays === 1 ? "" : "s"} early`
      : project.handoverDate && project.dueDate
        ? "On time"
        : null;

  return (
    <article
      className="client-portal-card grid gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
      style={{ borderLeftWidth: 3, borderLeftColor: accent }}
    >
      <div className="min-w-0">
        <p className="font-semibold text-white">{project.name}</p>
        {project.address ? <p className="truncate text-xs text-slate-500">{project.address}</p> : null}
        <div className="mt-2 max-w-xs">
          <ProjectProgressBar percent={100} />
        </div>
      </div>
      {project.leadName ? (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <AthleteAvatar
            name={project.leadName}
            photoUrl={project.leadPhotoUrl}
            backgroundColor={project.leadPhotoBgColor}
            textTone={asAvatarTextTone(project.leadPhotoTextTone)}
            size={24}
          />
          <span>{project.leadName}</span>
        </div>
      ) : (
        <span className="text-xs text-slate-600">—</span>
      )}
      <div className="text-xs text-slate-400">
        {project.dueDate ? <p>Due {formatShortDate(project.dueDate)}</p> : null}
        {project.handoverDate ? (
          <p className="text-emerald-400 client-portal-accent-emerald">Handover {formatShortDate(project.handoverDate)}</p>
        ) : null}
      </div>
      {outcome ? (
        <span className="client-portal-outcome-badge inline-flex w-fit items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase text-emerald-300">
          ↑ {outcome}
        </span>
      ) : (
        <span className="text-xs text-slate-600">—</span>
      )}
    </article>
  );
}

export function ClientPortalClient({
  data,
  slug,
  initialTab = "tracker",
}: {
  data: PublicClientPortalData;
  slug: string;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const calendarProjects = tab === "tracker" ? data.activeProjects : data.completedProjects;

  const dueMarks = useMemo(
    () =>
      calendarProjects
        .filter((p) => p.dueDate)
        .map((p) => ({
          date: p.dueDate!,
          label: `${p.name} due`,
          color: projectDueColor(daysUntilDueFromIso(p.dueDate)),
        })),
    [calendarProjects]
  );

  const openTaskCount = data.activeProjects.reduce((n, p) => n + p.openTasks.length, 0);

  return (
    <div className="flex min-h-screen">
      <aside className="client-portal-sidebar hidden w-56 shrink-0 flex-col border-r border-white/[0.06] bg-[var(--bg-sidebar)] px-4 py-6 lg:flex">
        <ClientPortalBrandMark />
        <p className="mt-8 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Your account</p>
        <nav className="mt-3 space-y-1">
          <button
            type="button"
            onClick={() => setTab("tracker")}
            className={`client-portal-nav block w-full rounded-lg px-3 py-2 text-left text-sm ${
              tab === "tracker" ? "client-portal-nav-active bg-white/[0.08] text-white" : "text-slate-400 hover:bg-white/[0.04]"
            }`}
          >
            Project tracker
          </button>
          <button
            type="button"
            onClick={() => setTab("completed")}
            className={`client-portal-nav block w-full rounded-lg px-3 py-2 text-left text-sm ${
              tab === "completed" ? "client-portal-nav-active bg-white/[0.08] text-white" : "text-slate-400 hover:bg-white/[0.04]"
            }`}
          >
            Completed projects
          </button>
        </nav>
        <div className="mt-auto pt-6">
          <PublicThemeToggle />
        </div>
      </aside>

      <div className="client-portal-main flex min-w-0 flex-1 flex-col">
        <header className="client-portal-header border-b border-white/[0.06] px-4 py-5 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <ClientAvatar
                name={data.client.name}
                logoUrl={data.client.logoUrl}
                backgroundColor={data.client.logoBgColor}
                textTone={asAvatarTextTone(data.client.logoTextTone)}
                size={48}
              />
              <div>
                <h1 className="text-xl font-semibold text-white sm:text-2xl">{data.client.name}</h1>
                <p className="mt-0.5 text-sm text-slate-400">
                  {tab === "tracker"
                    ? "Live view of active project status and deadlines."
                    : "Completed projects · full delivery record"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="client-portal-badge rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-300">
                Active lanes {data.client.activeLaneCount}
              </span>
              <span className="client-portal-badge client-portal-badge-brand rounded-lg border border-brand-500/40 bg-brand-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-brand-200">
                Client view
              </span>
              <div className="lg:hidden">
                <PublicThemeToggle />
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => setTab("tracker")}
              className={`client-portal-nav rounded-lg px-3 py-1.5 text-xs ${tab === "tracker" ? "client-portal-nav-active bg-white/10 text-white" : "text-slate-500"}`}
            >
              Project tracker
            </button>
            <button
              type="button"
              onClick={() => setTab("completed")}
              className={`client-portal-nav rounded-lg px-3 py-1.5 text-xs ${tab === "completed" ? "client-portal-nav-active bg-white/10 text-white" : "text-slate-500"}`}
            >
              Completed
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-8">
          {tab === "tracker" ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,300px)_1fr]">
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Project due dates</h2>
                <div className="client-portal-card mt-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                  <MiniMonthCalendar
                    month={calendarMonth}
                    marks={dueMarks}
                    onSelectDate={(date) => setCalendarMonth(date.slice(0, 7))}
                  />
                  <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-red-500" /> Overdue
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-amber-500" /> 1–3 days
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-yellow-400" /> 4–7 days
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-sky-500" /> 8–14 days
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" /> 14+ days
                    </span>
                  </div>
                </div>
                {openTaskCount > 0 ? (
                  <p className="mt-3 text-xs text-slate-500">
                    {openTaskCount} open kanban task{openTaskCount === 1 ? "" : "s"} across active projects
                  </p>
                ) : null}
              </section>

              <section>
                <h2 className="text-sm font-semibold text-white">Active projects</h2>
                {data.activeProjects.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">No active projects right now.</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {data.activeProjects.map((project) => (
                      <ProjectCard key={project.id} project={project} showTasks />
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : (
            <section className="space-y-4">
              <p className="text-sm text-slate-400">
                {data.completedProjects.length} completed project
                {data.completedProjects.length === 1 ? "" : "s"}
              </p>
              {data.completedProjects.length === 0 ? (
                <p className="text-sm text-slate-500">No completed projects yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.completedProjects.map((project) => (
                    <CompletedRow key={project.id} project={project} />
                  ))}
                </div>
              )}
            </section>
          )}
        </main>

        <footer className="client-portal-footer border-t border-white/[0.06] px-4 py-4 text-center text-[11px] text-slate-500 sm:px-8">
          Powered by Blocharch ·{" "}
          <Link href={clientPortalPath(slug)} className="text-slate-500 hover:text-slate-400">
            Client portal
          </Link>
        </footer>
      </div>
    </div>
  );
}
