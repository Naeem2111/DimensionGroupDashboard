import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthletePortalSession } from "@/lib/ops-access";
import {
  createCheckInCalendarEvent,
  loadCheckInRequest,
  serializeCheckInRequest,
} from "@/lib/check-in-requests";

type Ctx = { params: Promise<{ id: string }> };

/** Athlete confirms a counter-proposed time or cancels their request. */
export async function PATCH(request: NextRequest, context: Ctx) {
  const gate = await requireAthletePortalSession(request);
  if (gate instanceof NextResponse) return gate;
  const { athlete } = gate;
  const { id } = await context.params;

  const existing = await loadCheckInRequest(id);
  if (!existing || existing.athleteId !== athlete.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const action = String(body.action || "").trim();

    if (action === "cancel") {
      if (!["pending", "counter_proposed"].includes(existing.status)) {
        return NextResponse.json({ error: "Cannot cancel this request" }, { status: 400 });
      }
      const row = await prisma.opsCheckInRequest.update({
        where: { id },
        data: { status: "cancelled", resolvedAt: new Date() },
        include: {
          athlete: { select: { fullName: true, athleteCode: true, email: true } },
          project: { include: { client: { select: { name: true } } } },
        },
      });
      return NextResponse.json({ request: serializeCheckInRequest(row) });
    }

    if (action === "confirm_counter") {
      if (existing.status !== "counter_proposed") {
        return NextResponse.json({ error: "No proposed time to confirm" }, { status: 400 });
      }
      if (!existing.counterStartAt || !existing.counterEndAt) {
        return NextResponse.json({ error: "Missing proposed time" }, { status: 400 });
      }

      const cal = await createCheckInCalendarEvent(
        existing,
        existing.counterStartAt,
        existing.counterEndAt
      );

      const row = await prisma.opsCheckInRequest.update({
        where: { id },
        data: {
          status: "confirmed",
          resolvedAt: new Date(),
          googleEventId: cal.googleEventId,
          googleEventLink: cal.googleEventLink,
        },
        include: {
          athlete: { select: { fullName: true, athleteCode: true, email: true } },
          project: { include: { client: { select: { name: true } } } },
        },
      });

      return NextResponse.json({ request: serializeCheckInRequest(row) });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not update request";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
