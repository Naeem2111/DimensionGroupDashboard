"use client";

import { useCallback, useEffect, useState } from "react";
import {
  COMPLEXITY_LABELS,
  PROJECT_PHASE_LABELS,
  PROJECT_STATUS_LABELS,
} from "@/lib/ops-constants";

type ProjectDetail = {
  id: string;
  displayTitle: string;
  name: string;
  stageLabel: string;
  projectNumber: string;
  address: string | null;
  clientName: string;
  assignedAthleteName: string | null;
  assignedAthleteCode: string | null;
  currentStage: keyof typeof PROJECT_PHASE_LABELS;
  currentStatus: string;
  complexity: keyof typeof COMPLEXITY_LABELS;
  progressPercent: number | null;
  hoursLogged: number;
  startDate: string | null;
  dueDate: string | null;
  handoverDate: string | null;
  completedAt: string | null;
  notes: string | null;
};

type SubmissionRow = {
  id: string;
  submissionDate: string;
  athleteName: string;
  totalHours: number;
  isBackloggedSession: boolean;
  dailyNote: string | null;
  lineItems: Array<{
    projectPhase: string;
    hoursWorked: number;
    completionPercent: number | null;
    completedSummary: string | null;
  }>;
};

export function ArchiveProjectDetailPanel({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/ops/projects/${encodeURIComponent(projectId)}`);
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Could not load project");
      setLoading(false);
      return;
    }
    setProject(j.project);
    setSubmissions(j.submissions || []);
    setError("");
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-10">
      <div className="card-tool w-full max-w-3xl rounded-xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">{project?.displayTitle ?? "Project"}</h2>
            <p className="text-xs text-slate-500">Project ID: {projectId}</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-slate-400 hover:text-white">
            Close
          </button>
        </div>

        {loading ? <p className="mt-4 text-sm text-slate-500">Loading…</p> : null}
        {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

        {project ? (
          <div className="mt-4 space-y-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">Client</dt>
                <dd className="text-slate-200">{project.clientName}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Stage / package</dt>
                <dd className="text-slate-200">{project.stageLabel}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Address</dt>
                <dd className="text-slate-200">{project.address ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Athlete</dt>
                <dd className="text-slate-200">
                  {project.assignedAthleteName ?? "Unassigned"}
                  {project.assignedAthleteCode ? ` · ${project.assignedAthleteCode}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Status</dt>
                <dd className="text-slate-200">
                  {PROJECT_STATUS_LABELS[project.currentStatus as keyof typeof PROJECT_STATUS_LABELS] ??
                    project.currentStatus}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Hours logged</dt>
                <dd className="text-slate-200">{project.hoursLogged}h</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Progress</dt>
                <dd className="text-slate-200">{project.progressPercent ?? 0}%</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Completed</dt>
                <dd className="text-slate-200">{project.completedAt ?? "—"}</dd>
              </div>
            </dl>
            {project.notes ? (
              <div>
                <p className="text-xs text-slate-500">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{project.notes}</p>
              </div>
            ) : null}

            <div>
              <h3 className="text-sm font-semibold text-white">Daily submissions</h3>
              {submissions.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No daily logs for this project.</p>
              ) : (
                <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                  {submissions.map((s) => (
                    <li key={s.id} className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs">
                      <p className="font-medium text-slate-200">
                        {s.submissionDate} · {s.athleteName} · {s.totalHours}h
                        {s.isBackloggedSession ? (
                          <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300">
                            Backlogged
                          </span>
                        ) : null}
                      </p>
                      {s.dailyNote ? <p className="mt-1 text-slate-500">{s.dailyNote}</p> : null}
                      {s.lineItems.map((li, i) => (
                        <p key={i} className="mt-1 text-slate-400">
                          {li.hoursWorked}h · {li.completionPercent ?? 0}%
                          {li.completedSummary ? ` · ${li.completedSummary}` : ""}
                        </p>
                      ))}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="text-xs text-slate-500">
              Edit this project from Ops → Projects (use “All” view) or ask ops to update archived records.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
