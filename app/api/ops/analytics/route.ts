import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireOpsSession } from "@/lib/ops-access";
import { buildAnalytics } from "@/lib/ops-commercial";
import { parseDateOnly } from "@/lib/ops-hours";

function monthFromQuery(request: NextRequest): Date {
  const raw = request.nextUrl.searchParams.get("month");
  if (raw && parseDateOnly(`${raw}-01`)) return parseDateOnly(`${raw}-01`)!;
  return new Date();
}

export async function GET(request: NextRequest) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const clientId = request.nextUrl.searchParams.get("clientId")?.trim() || null;
  const athleteId = request.nextUrl.searchParams.get("athleteId")?.trim() || null;
  const analytics = await buildAnalytics(monthFromQuery(request), { clientId, athleteId });
  return NextResponse.json(analytics);
}
