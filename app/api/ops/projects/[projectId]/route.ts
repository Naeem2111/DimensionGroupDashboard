import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isOpsProjectComplexity,
  isOpsProjectPhase,
  isOpsProjectStatus,
} from "@/lib/ops-constants";
import { requireOpsSession } from "@/lib/ops-access";
import { parseDateOnly } from "@/lib/ops-hours";
import { syncProjectAfterOpsUpdate } from "@/lib/planner-project-sync";
import { normalizeAthleteProjectCode } from "@/lib/ops-project-code";
import { projectDisplayFields } from "@/lib/project-display";
import { validateProjectLeadContactDb } from "@/lib/ops-project-lead";
import type { OpsProjectStatus } from "@prisma/client";

type RouteContext = { params: Promise<{ projectId: string }> };

function serializeOpsProject(
  project: {
    id: string;
    clientId: string;
    assignedAthleteId: string | null;
    projectLeadContactId: string | null;
    name: string;
    projectNumber: string;
    address: string | null;
    projectLead: string | null;
    complexity: string;
    startDate: Date | null;
    dueDate: Date | null;
    handoverDate: Date | null;
    currentStage: Parameters<typeof projectDisplayFields>[0]["currentStage"];
    currentStatus: string;
    progressPercent: number | null;
    completedAt: Date | null;
    deadlineBeatenDays: number | null;
    notes: string | null;
    blockerFlag: boolean;
    checkInRequested: boolean;
    client: { id: string; name: string };
    assignedAthlete: { id: string; fullName: string; athleteCode: string } | null;
    projectLeadContact: { id: string; name: string; email: string | null } | null;
  },
  hoursLogged: number
) {
  const { displayTitle, stageLabel } = projectDisplayFields(project);
  return {
    id: project.id,
    clientId: project.clientId,
    clientName: project.client.name,
    assignedAthleteId: project.assignedAthleteId,
    assignedAthleteName: project.assignedAthlete?.fullName ?? null,
    assignedAthleteCode: project.assignedAthlete?.athleteCode ?? null,
    projectLeadContactId: project.projectLeadContactId,
    projectLeadContactName: project.projectLeadContact?.name ?? null,
    projectLeadContactEmail: project.projectLeadContact?.email ?? null,
    name: project.name,
    displayTitle,
    stageLabel,
    projectNumber: project.projectNumber,
    address: project.address,
    projectLead: project.projectLead,
    complexity: project.complexity,
    startDate: project.startDate?.toISOString().slice(0, 10) ?? null,
    dueDate: project.dueDate?.toISOString().slice(0, 10) ?? null,
    handoverDate: project.handoverDate?.toISOString().slice(0, 10) ?? null,
    currentStage: project.currentStage,
    currentStatus: project.currentStatus,
    progressPercent: project.progressPercent,
    completedAt: project.completedAt?.toISOString().slice(0, 10) ?? null,
    deadlineBeatenDays: project.deadlineBeatenDays,
    hoursLogged,
    notes: project.notes,
    blockerFlag: project.blockerFlag,
    checkInRequested: project.checkInRequested,
  };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const gate = await requireOpsSession(_request);
  if (gate instanceof NextResponse) return gate;

  const { projectId } = await context.params;
  const project = await prisma.opsProject.findUnique({
    where: { id: projectId },
    include: {
      client: { select: { id: true, name: true } },
      assignedAthlete: { select: { id: true, fullName: true, athleteCode: true } },
      projectLeadContact: { select: { id: true, name: true, email: true } },
    },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const hoursAgg = await prisma.opsSubmissionLineItem.aggregate({
    where: { projectId },
    _sum: { hoursWorked: true },
  });

  const submissions = await prisma.opsDailySubmission.findMany({
    where: { lineItems: { some: { projectId } } },
    orderBy: { submissionDate: "desc" },
    take: 60,
    include: {
      athlete: { select: { fullName: true, athleteCode: true } },
      lineItems: {
        where: { projectId },
        include: {
          client: { select: { name: true } },
        },
      },
    },
  });

  return NextResponse.json({
    project: serializeOpsProject(project, Number(hoursAgg._sum.hoursWorked ?? 0)),
    submissions: submissions.map((s) => ({
      id: s.id,
      submissionDate: s.submissionDate.toISOString().slice(0, 10),
      athleteName: s.athlete.fullName,
      athleteCode: s.athlete.athleteCode,
      totalHours: Number(s.totalHours),
      isBackloggedSession: s.isBackloggedSession,
      dailyNote: s.dailyNote,
      lineItems: s.lineItems.map((li) => ({
        id: li.id,
        projectPhase: li.projectPhase,
        taskType: li.taskType,
        taskTypes: li.taskTypes,
        hoursWorked: Number(li.hoursWorked),
        completionPercent: li.completionPercent,
        completedSummary: li.completedSummary,
        notes: li.notes,
      })),
    })),
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const { projectId } = await context.params;
  const existing = await prisma.opsProject.findUnique({ where: { id: projectId } });
  if (!existing) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  try {
    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.name != null) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ error: "Project name required" }, { status: 400 });
      data.name = name;
    }
    if (body.assignedAthleteId !== undefined) {
      const aid = body.assignedAthleteId ? String(body.assignedAthleteId).trim() : null;
      if (aid) {
        const athlete = await prisma.opsAthlete.findUnique({ where: { id: aid } });
        if (!athlete) return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
      }
      data.assignedAthleteId = aid;
    }
    if (body.projectNumber != null) {
      const projectNumber = normalizeAthleteProjectCode(String(body.projectNumber));
      if (!projectNumber) return NextResponse.json({ error: "Athlete code is required" }, { status: 400 });
      data.projectNumber = projectNumber;
    }
    if (body.projectLeadContactId !== undefined) {
      const cid = body.projectLeadContactId ? String(body.projectLeadContactId).trim() : null;
      const leadError = await validateProjectLeadContactDb(prisma, existing.clientId, cid);
      if (leadError) return NextResponse.json({ error: leadError }, { status: 400 });
      data.projectLeadContactId = cid;
      data.projectLeadAthleteId = null;
    }
    if (body.address !== undefined) data.address = body.address ? String(body.address).trim() : null;
    if (body.projectLead !== undefined) data.projectLead = body.projectLead ? String(body.projectLead).trim() : null;
    if (body.notes !== undefined) data.notes = body.notes ? String(body.notes).trim() : null;
    if (body.progressPercent !== undefined) {
      const pct = body.progressPercent == null ? null : Math.max(0, Math.min(100, Math.round(Number(body.progressPercent))));
      data.progressPercent = pct;
    }

    if (body.complexity != null) {
      const c = String(body.complexity);
      if (!isOpsProjectComplexity(c)) return NextResponse.json({ error: "Invalid complexity" }, { status: 400 });
      data.complexity = c;
    }
    if (body.currentStage != null) {
      const s = String(body.currentStage);
      if (!isOpsProjectPhase(s)) return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
      data.currentStage = s;
    }
    if (body.currentStatus != null) {
      const s = String(body.currentStatus);
      if (!isOpsProjectStatus(s)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      data.currentStatus = s;
    }

    if (body.startDate !== undefined) data.startDate = body.startDate ? parseDateOnly(String(body.startDate)) : null;
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? parseDateOnly(String(body.dueDate)) : null;
    if (body.handoverDate !== undefined) data.handoverDate = body.handoverDate ? parseDateOnly(String(body.handoverDate)) : null;

    if (body.blockerFlag !== undefined) data.blockerFlag = Boolean(body.blockerFlag);
    if (body.checkInRequested !== undefined) data.checkInRequested = Boolean(body.checkInRequested);

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const project = await prisma.opsProject.update({
      where: { id: projectId },
      include: {
        client: { select: { id: true, name: true } },
        assignedAthlete: { select: { id: true, fullName: true, athleteCode: true } },
        projectLeadContact: { select: { id: true, name: true, email: true } },
      },
      data,
    });

    await syncProjectAfterOpsUpdate(
      projectId,
      {
        assignedAthleteId: existing.assignedAthleteId,
        currentStatus: existing.currentStatus,
        name: existing.name,
      },
      {
        assignedAthleteId: project.assignedAthleteId,
        currentStatus: project.currentStatus as OpsProjectStatus,
        name: project.name,
      }
    ).catch(() => {});

    const hoursAgg = await prisma.opsSubmissionLineItem.aggregate({
      where: { projectId },
      _sum: { hoursWorked: true },
    });

    return NextResponse.json({
      project: serializeOpsProject(project, Number(hoursAgg._sum.hoursWorked ?? 0)),
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const { projectId } = await context.params;
  const existing = await prisma.opsProject.findUnique({ where: { id: projectId } });
  if (!existing) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  await prisma.opsProject.delete({ where: { id: projectId } });
  return NextResponse.json({ ok: true });
}
