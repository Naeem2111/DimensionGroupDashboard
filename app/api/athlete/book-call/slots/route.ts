import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { OpsCheckInStatus } from "@prisma/client";
import { requireBookCallReadAccess } from "@/lib/book-call-access";
import { isGoogleCalendarConfigured, listAvailableSlots } from "@/lib/google-calendar";
import { prisma } from "@/lib/prisma";

const ACTIVE_STATUSES: OpsCheckInStatus[] = [
  "pending",
  "counter_proposed",
  "approved",
  "confirmed",
];

export async function GET(request: NextRequest) {
  const gate = await requireBookCallReadAccess(request);
  if (gate instanceof NextResponse) return gate;

  let extraBusy: Array<{ start: Date; end: Date }> = [];
  try {
    const pending = await prisma.opsCheckInRequest.findMany({
      where: { status: { in: ACTIVE_STATUSES } },
      select: {
        requestedStartAt: true,
        requestedEndAt: true,
        counterStartAt: true,
        counterEndAt: true,
      },
    });

    extraBusy = pending.flatMap((r) => {
    const blocks: Array<{ start: Date; end: Date }> = [
      { start: r.requestedStartAt, end: r.requestedEndAt },
    ];
    if (r.counterStartAt && r.counterEndAt) {
      blocks.push({ start: r.counterStartAt, end: r.counterEndAt });
    }
      return blocks;
    });
  } catch (e) {
    console.error("book-call slots: could not load pending requests", e);
  }

  const { slots, source } = await listAvailableSlots(extraBusy);

  return NextResponse.json({
    slots,
    source,
    calendarConnected: isGoogleCalendarConfigured(),
  });
}
