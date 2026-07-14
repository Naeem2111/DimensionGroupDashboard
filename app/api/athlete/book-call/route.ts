import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthletePortalSession } from "@/lib/ops-access";
import { notifyOpsCheckInRequest } from "@/lib/check-in-admin";
import { serializeCheckInRequest } from "@/lib/check-in-requests";

const checkInInclude = {
  athlete: { select: { fullName: true, athleteCode: true, email: true } },
  project: { include: { client: { select: { name: true } } } },
} as const;

export async function GET(request: NextRequest) {
  const gate = await requireAthletePortalSession(request);
  if (gate instanceof NextResponse) return gate;
  const { athlete } = gate;

  const rows = await prisma.opsCheckInRequest.findMany({
    where: { athleteId: athlete.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: checkInInclude,
  });

  return NextResponse.json({
    requests: rows.map(serializeCheckInRequest),
  });
}

export async function POST(request: NextRequest) {
  const gate = await requireAthletePortalSession(request);
  if (gate instanceof NextResponse) return gate;
  const { athlete } = gate;

  try {
    const body = await request.json();
    const reason = String(body.reason || "").trim();
    const projectId = body.projectId ? String(body.projectId).trim() : null;
    const contextNotes = body.contextNotes ? String(body.contextNotes).trim() : null;
    const startRaw = String(body.requestedStartAt || "").trim();
    const endRaw = String(body.requestedEndAt || "").trim();

    if (reason.length < 3) {
      return NextResponse.json({ error: "Please provide a reason (min 3 characters)" }, { status: 400 });
    }
    if (!startRaw || !endRaw) {
      return NextResponse.json({ error: "Select a time slot" }, { status: 400 });
    }

    const requestedStartAt = new Date(startRaw);
    const requestedEndAt = new Date(endRaw);
    if (Number.isNaN(requestedStartAt.getTime()) || Number.isNaN(requestedEndAt.getTime())) {
      return NextResponse.json({ error: "Invalid time slot" }, { status: 400 });
    }
    if (requestedEndAt <= requestedStartAt) {
      return NextResponse.json({ error: "Invalid slot duration" }, { status: 400 });
    }

    if (!projectId) {
      return NextResponse.json({ error: "Project is required" }, { status: 400 });
    }

    const project = await prisma.opsProject.findFirst({
      where: { id: projectId, assignedAthleteId: athlete.id },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found on your account" }, { status: 400 });
    }

    const row = await prisma.opsCheckInRequest.create({
      data: {
        athleteId: athlete.id,
        projectId,
        reason,
        contextNotes,
        requestedStartAt,
        requestedEndAt,
        status: "pending",
        source: body.source === "daily_log" ? "daily_log" : "book_a_call",
      },
      include: checkInInclude,
    });

    await notifyOpsCheckInRequest({
      id: row.id,
      athleteId: row.athleteId,
      projectId: row.projectId,
      reason: row.reason,
      source: row.source,
      athlete: row.athlete,
      project: row.project,
    });

    if (projectId) {
      await prisma.opsProject.update({
        where: { id: projectId },
        data: { checkInRequested: true },
      });
    }

    return NextResponse.json({ request: serializeCheckInRequest(row) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
