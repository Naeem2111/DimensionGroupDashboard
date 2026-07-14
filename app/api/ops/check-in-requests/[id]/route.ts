import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOpsSession } from "@/lib/ops-access";
import { acknowledgeCheckInRequest } from "@/lib/check-in-admin";
import {
  createCheckInCalendarEvent,
  loadCheckInRequest,
  serializeCheckInRequest,
  syncCalendarEventDescription,
} from "@/lib/check-in-requests";
import { createAthleteNotification } from "@/lib/ops-athlete-notifications";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Ctx) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;
  const { id } = await context.params;

  const existing = await loadCheckInRequest(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();
    const action = String(body.action || "").trim();
    const adminNote = body.adminNote != null ? String(body.adminNote).trim() : undefined;
    const zoomLink = body.zoomLink != null ? String(body.zoomLink).trim() : undefined;

    if (action === "set_status") {
      const status = String(body.status || "").trim();

      if (status === "scheduled") {
        if (["approved", "confirmed"].includes(existing.status)) {
          return NextResponse.json({ request: serializeCheckInRequest(existing) });
        }

        const row = await prisma.opsCheckInRequest.update({
          where: { id },
          data: {
            status: "approved",
            resolvedByUserId: user.id,
            resolvedAt: new Date(),
          },
          include: {
            athlete: { select: { id: true, fullName: true, athleteCode: true, email: true } },
            project: { include: { client: { select: { name: true } } } },
          },
        });

        await createAthleteNotification({
          athleteId: row.athlete.id,
          type: "check_in_update",
          title: "Check-in scheduled",
          message: null,
          linkPath: "/dashboard/athlete/book-call",
        }).catch(() => {});

        await acknowledgeCheckInRequest(row.id, row.athlete.id, row.projectId);

        return NextResponse.json({ request: serializeCheckInRequest(row) });
      }

      if (status === "pending") {
        if (["pending", "counter_proposed"].includes(existing.status)) {
          return NextResponse.json({ request: serializeCheckInRequest(existing) });
        }
        const row = await prisma.opsCheckInRequest.update({
          where: { id },
          data: {
            status: "pending",
            resolvedByUserId: null,
            resolvedAt: null,
          },
          include: {
            athlete: { select: { id: true, fullName: true, athleteCode: true, email: true } },
            project: { include: { client: { select: { name: true } } } },
          },
        });
        return NextResponse.json({ request: serializeCheckInRequest(row) });
      }

      return NextResponse.json({ error: "status must be pending or scheduled" }, { status: 400 });
    }

    if (action === "decline") {
      const row = await prisma.opsCheckInRequest.update({
        where: { id },
        data: {
          status: "declined",
          adminNote: adminNote ?? null,
          resolvedByUserId: user.id,
          resolvedAt: new Date(),
        },
        include: {
          athlete: { select: { id: true, fullName: true, athleteCode: true, email: true } },
          project: { include: { client: { select: { name: true } } } },
        },
      });
      await createAthleteNotification({
        athleteId: row.athlete.id,
        type: "check_in_update",
        title: "Check-in request declined",
        message: adminNote ?? null,
        linkPath: "/dashboard/athlete/book-call",
      }).catch(() => {});
      await acknowledgeCheckInRequest(row.id, row.athlete.id, row.projectId);
      return NextResponse.json({ request: serializeCheckInRequest(row) });
    }

    if (action === "approve") {
      if (!["pending", "counter_proposed"].includes(existing.status)) {
        return NextResponse.json({ error: "Request is not awaiting approval" }, { status: 400 });
      }

      const start =
        existing.status === "counter_proposed" && existing.counterStartAt
          ? existing.counterStartAt
          : existing.requestedStartAt;
      const end =
        existing.status === "counter_proposed" && existing.counterEndAt
          ? existing.counterEndAt
          : existing.requestedEndAt;

      const cal = await createCheckInCalendarEvent(existing, start, end);

      const row = await prisma.opsCheckInRequest.update({
        where: { id },
        data: {
          status: "approved",
          adminNote: adminNote ?? existing.adminNote,
          zoomLink: zoomLink ?? existing.zoomLink,
          googleEventId: cal.googleEventId,
          googleEventLink: cal.googleEventLink,
          resolvedByUserId: user.id,
          resolvedAt: new Date(),
        },
        include: {
          athlete: { select: { id: true, fullName: true, athleteCode: true, email: true } },
          project: { include: { client: { select: { name: true } } } },
        },
      });

      if (row.googleEventId && (zoomLink || adminNote)) {
        await syncCalendarEventDescription(row.googleEventId, row).catch(() => {});
      }

      await createAthleteNotification({
        athleteId: row.athlete.id,
        type: "check_in_update",
        title: "Check-in approved",
        message: row.zoomLink ? `Zoom: ${row.zoomLink}` : adminNote ?? null,
        linkPath: "/dashboard/athlete/book-call",
      }).catch(() => {});

      await acknowledgeCheckInRequest(row.id, row.athlete.id, row.projectId);

      return NextResponse.json({ request: serializeCheckInRequest(row) });
    }

    if (action === "counter") {
      const counterStartRaw = String(body.counterStartAt || "").trim();
      const counterEndRaw = String(body.counterEndAt || "").trim();
      if (!counterStartRaw || !counterEndRaw) {
        return NextResponse.json({ error: "Proposed start and end required" }, { status: 400 });
      }
      const counterStartAt = new Date(counterStartRaw);
      const counterEndAt = new Date(counterEndRaw);
      if (Number.isNaN(counterStartAt.getTime()) || Number.isNaN(counterEndAt.getTime())) {
        return NextResponse.json({ error: "Invalid proposed times" }, { status: 400 });
      }

      const row = await prisma.opsCheckInRequest.update({
        where: { id },
        data: {
          status: "counter_proposed",
          counterStartAt,
          counterEndAt,
          adminNote: adminNote ?? null,
          zoomLink: zoomLink ?? existing.zoomLink,
        },
        include: {
          athlete: { select: { id: true, fullName: true, athleteCode: true, email: true } },
          project: { include: { client: { select: { name: true } } } },
        },
      });
      await createAthleteNotification({
        athleteId: row.athlete.id,
        type: "check_in_update",
        title: "New check-in time proposed",
        message: adminNote ?? "Please confirm the proposed time in Book a Call.",
        linkPath: "/dashboard/athlete/book-call",
      }).catch(() => {});
      return NextResponse.json({ request: serializeCheckInRequest(row) });
    }

    if (action === "update") {
      const row = await prisma.opsCheckInRequest.update({
        where: { id },
        data: {
          ...(zoomLink !== undefined ? { zoomLink: zoomLink || null } : {}),
          ...(adminNote !== undefined ? { adminNote: adminNote || null } : {}),
        },
        include: {
          athlete: { select: { fullName: true, athleteCode: true, email: true } },
          project: { include: { client: { select: { name: true } } } },
        },
      });
      if (row.googleEventId) {
        await syncCalendarEventDescription(row.googleEventId, row).catch(() => {});
      }
      return NextResponse.json({ request: serializeCheckInRequest(row) });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not update request";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
