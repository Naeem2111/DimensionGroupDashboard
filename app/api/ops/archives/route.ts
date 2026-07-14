import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireOpsSession } from "@/lib/ops-access";
import { buildOpsArchives } from "@/lib/ops-archives";

export async function GET(request: NextRequest) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const clientId = request.nextUrl.searchParams.get("clientId") || undefined;
  const athleteId = request.nextUrl.searchParams.get("athleteId") || undefined;

  const data = await buildOpsArchives({ clientId, athleteId });
  return NextResponse.json(data);
}
