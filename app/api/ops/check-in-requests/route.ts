import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { OpsCheckInStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOpsSession } from "@/lib/ops-access";
import { serializeCheckInRequest } from "@/lib/check-in-requests";
import { isGoogleCalendarConfigured } from "@/lib/google-calendar";

const include = {
  athlete: { select: { fullName: true, athleteCode: true, email: true, profilePhotoUrl: true, profilePhotoBgColor: true, profilePhotoTextTone: true } },
  project: { include: { client: { select: { name: true } } } },
} as const;

export async function GET(request: NextRequest) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const status = request.nextUrl.searchParams.get("status")?.trim();
  const pendingStatuses: OpsCheckInStatus[] = ["pending", "counter_proposed"];

  let where: Prisma.OpsCheckInRequestWhereInput | undefined;
  if (status === "pending") {
    where = { status: { in: pendingStatuses } };
  } else if (status === "scheduled") {
    where = { status: { in: ["approved", "confirmed"] } };
  } else if (status && status !== "all") {
    where = { status: status as OpsCheckInStatus };
  }

  const rows = await prisma.opsCheckInRequest.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    include,
  });

  const pendingCount = await prisma.opsCheckInRequest.count({
    where: { status: { in: pendingStatuses } },
  });

  return NextResponse.json({
    requests: rows.map(serializeCheckInRequest),
    pendingCount,
    calendarConnected: isGoogleCalendarConfigured(),
  });
}
