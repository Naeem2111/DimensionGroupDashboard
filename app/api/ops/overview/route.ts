import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireOpsOverviewSession } from "@/lib/ops-access";
import { buildOpsOverview } from "@/lib/ops-commercial";

export async function GET(request: NextRequest) {
  const gate = await requireOpsOverviewSession(request);
  if (gate instanceof NextResponse) return gate;

  const includeFinancials = gate.user.role === "admin";
  const overview = await buildOpsOverview(new Date(), { includeFinancials });
  return NextResponse.json({ ...overview, viewerRole: gate.user.role });
}
