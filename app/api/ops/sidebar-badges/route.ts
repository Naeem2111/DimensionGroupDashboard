import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { countPendingCheckInRequests, pendingCheckInAthleteIds } from "@/lib/check-in-admin";
import { prisma } from "@/lib/prisma";
import { requireOpsSession } from "@/lib/ops-access";

export async function GET(request: NextRequest) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const [pendingCheckIns, pendingAthletes] = await Promise.all([
    countPendingCheckInRequests(),
    pendingCheckInAthleteIds(),
  ]);

  const submissionCheckIns =
    pendingAthletes.size === 0
      ? 0
      : await prisma.opsDailySubmission.count({
          where: {
            checkInRequested: true,
            athleteId: { in: Array.from(pendingAthletes) },
          },
        });

  return NextResponse.json({
    checkIns: pendingCheckIns,
    submissionCheckIns,
    urgent: pendingCheckIns > 0,
  });
}
