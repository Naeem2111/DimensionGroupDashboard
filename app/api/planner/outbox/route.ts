import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isApprovedLabelName } from "@/lib/planner-approved-labels";
import { requirePlannerSession } from "@/lib/planner-access";
import { createAndDeliverOutboxTask } from "@/lib/planner-outbox";

export async function GET(request: NextRequest) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;

  if (user.role !== "admin" && user.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") || "50", 10)));

  const rows = await prisma.opsOutboxTask.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      athlete: { select: { id: true, fullName: true, athleteCode: true } },
      project: { select: { id: true, name: true, client: { select: { name: true } } } },
    },
  });

  return NextResponse.json({
    tasks: rows.map((r) => ({
      id: r.id,
      athleteId: r.athleteId,
      athleteName: r.athlete.fullName,
      athleteCode: r.athlete.athleteCode,
      projectId: r.projectId,
      projectName: r.project?.name ?? null,
      clientName: r.project?.client?.name ?? null,
      title: r.title,
      description: r.description,
      dueAt: r.dueAt?.toISOString() ?? null,
      labelName: r.labelName,
      notes: r.notes,
      deliveredAt: r.deliveredAt?.toISOString() ?? null,
      inboxTaskId: r.inboxTaskId,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;

  if (user.role !== "admin" && user.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const athleteId = String(body.athleteId || "").trim();
    if (!athleteId) {
      return NextResponse.json({ error: "Athlete is required" }, { status: 400 });
    }

    const labelRaw = body.labelName != null ? String(body.labelName).trim() : "";
    const labelName = labelRaw && isApprovedLabelName(labelRaw) ? labelRaw : null;

    let dueAt: Date | null = null;
    if (body.dueAt) {
      const d = new Date(String(body.dueAt));
      if (!Number.isNaN(d.getTime())) dueAt = d;
    }

    const id = await createAndDeliverOutboxTask({
      createdByUserId: user.id,
      athleteId,
      projectId: body.projectId ? String(body.projectId).trim() : null,
      title: body.title != null ? String(body.title) : null,
      description: body.description != null ? String(body.description) : null,
      dueAt,
      labelName,
      notes: body.notes != null ? String(body.notes) : null,
      attachments: body.attachments,
    });

    const row = await prisma.opsOutboxTask.findUnique({
      where: { id },
      select: { id: true, inboxTaskId: true, deliveredAt: true },
    });

    return NextResponse.json({ task: row }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid request";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
