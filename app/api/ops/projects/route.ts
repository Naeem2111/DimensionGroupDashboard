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
import { syncProjectBoardOnAssign } from "@/lib/planner-project-sync";
import { normalizeAthleteProjectCode } from "@/lib/ops-project-code";
import { projectDisplayFields } from "@/lib/project-display";
import { validateProjectLeadContactDb } from "@/lib/ops-project-lead";

const ACTIVE_STATUSES = ["completed", "handed_over"] as const;

export async function GET(request: NextRequest) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const scope = request.nextUrl.searchParams.get("scope") || "active";
  const where =
    scope === "all"
      ? {}
      : scope === "archived"
        ? { currentStatus: { in: [...ACTIVE_STATUSES] } }
        : { currentStatus: { notIn: [...ACTIVE_STATUSES] } };

  const projects = await prisma.opsProject.findMany({
    where,
    orderBy: [{ dueDate: "asc" }, { name: "asc" }],
    include: {
      client: { select: { id: true, name: true, logoUrl: true, logoBgColor: true, logoTextTone: true } },
      assignedAthlete: { select: { id: true, fullName: true, athleteCode: true } },
      projectLeadContact: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({
    projects: projects.map((p) => {
      const { displayTitle, stageLabel } = projectDisplayFields(p);
      return {
        id: p.id,
        clientId: p.clientId,
        clientName: p.client.name,
        clientLogoUrl: p.client.logoUrl,
        clientLogoBgColor: p.client.logoBgColor,
        clientLogoTextTone: p.client.logoTextTone,
        assignedAthleteId: p.assignedAthleteId,
        assignedAthleteName: p.assignedAthlete?.fullName ?? null,
        projectLeadContactId: p.projectLeadContactId,
        projectLeadContactName: p.projectLeadContact?.name ?? null,
        projectLeadContactEmail: p.projectLeadContact?.email ?? null,
        athleteCode: p.assignedAthlete?.athleteCode ?? null,
        name: p.name,
        displayTitle,
        stageLabel,
        projectNumber: p.projectNumber,
        address: p.address,
        projectLead: p.projectLead,
        complexity: p.complexity,
        startDate: p.startDate?.toISOString().slice(0, 10) ?? null,
        dueDate: p.dueDate?.toISOString().slice(0, 10) ?? null,
        handoverDate: p.handoverDate?.toISOString().slice(0, 10) ?? null,
        currentStage: p.currentStage,
        currentStatus: p.currentStatus,
        progressPercent: p.progressPercent,
        completedAt: p.completedAt?.toISOString().slice(0, 10) ?? null,
        notes: p.notes,
        blockerFlag: p.blockerFlag,
        checkInRequested: p.checkInRequested,
        updatedAt: p.updatedAt.toISOString(),
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  try {
    const body = await request.json();
    const clientId = String(body.clientId || "").trim();
    let name = String(body.name || "").trim();
    const assignedAthleteId = body.assignedAthleteId ? String(body.assignedAthleteId).trim() : null;

    const projectLeadContactId = body.projectLeadContactId
      ? String(body.projectLeadContactId).trim()
      : null;

    const complexity = isOpsProjectComplexity(String(body.complexity || ""))
      ? body.complexity
      : "medium";
    const currentStage = isOpsProjectPhase(String(body.currentStage || ""))
      ? body.currentStage
      : "survey_conversion";
    const currentStatus = isOpsProjectStatus(String(body.currentStatus || ""))
      ? body.currentStatus
      : "not_started";

    const client = await prisma.opsClient.findUnique({ where: { id: clientId } });
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    const athlete = assignedAthleteId
      ? await prisma.opsAthlete.findUnique({ where: { id: assignedAthleteId } })
      : null;
    if (assignedAthleteId && !athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    const projectNumber = normalizeAthleteProjectCode(
      String(body.projectNumber || athlete?.athleteCode || "")
    );

    if (!clientId || !assignedAthleteId || !projectNumber) {
      return NextResponse.json(
        { error: "Client, assigned athlete, and athlete code are required" },
        { status: 400 }
      );
    }

    const address = body.address ? String(body.address).trim() : null;
    if (!name && address) {
      name = address;
    }
    if (!name) {
      return NextResponse.json({ error: "Project title is required" }, { status: 400 });
    }

    const leadError = await validateProjectLeadContactDb(prisma, clientId, projectLeadContactId);
    if (leadError) return NextResponse.json({ error: leadError }, { status: 400 });

    const project = await prisma.opsProject.create({
      data: {
        clientId,
        assignedAthleteId,
        projectLeadContactId,
        projectLeadAthleteId: null,
        name,
        projectNumber,
        address,
        projectLead: body.projectLead ? String(body.projectLead).trim() : null,
        complexity,
        currentStage,
        currentStatus,
        startDate: body.startDate ? parseDateOnly(String(body.startDate)) : null,
        dueDate: body.dueDate ? parseDateOnly(String(body.dueDate)) : null,
        handoverDate: body.handoverDate ? parseDateOnly(String(body.handoverDate)) : null,
        notes: body.notes ? String(body.notes).trim() : null,
      },
    });

    if (assignedAthleteId) {
      await syncProjectBoardOnAssign(project.id).catch(() => {});
    }

    const { displayTitle } = projectDisplayFields(project);
    return NextResponse.json({ project: { id: project.id, name: project.name, displayTitle } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
