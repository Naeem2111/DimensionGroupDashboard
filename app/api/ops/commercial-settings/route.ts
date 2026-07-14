import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireOpsSession } from "@/lib/ops-access";
import { fetchLiveGbpToZarQuote } from "@/lib/fx-live";
import {
  getCostConversionMode,
  setCostConversionMode,
  type CostConversionMode,
} from "@/lib/ops-commercial-settings";
import { getCostConversionSnapshot } from "@/lib/ops-exchange";

export async function GET(request: NextRequest) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const reference = new Date();
  const snapshot = await getCostConversionSnapshot(reference);
  let liveQuote: Awaited<ReturnType<typeof fetchLiveGbpToZarQuote>> | null = null;
  try {
    liveQuote = await fetchLiveGbpToZarQuote();
  } catch {
    liveQuote = null;
  }

  return NextResponse.json({
    costConversionMode: snapshot.mode,
    appliedRate: snapshot.appliedRate,
    reportingRate: snapshot.reportingRate,
    storedLiveRate: snapshot.liveRate,
    liveQuote,
  });
}

export async function PATCH(request: NextRequest) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  try {
    const body = await request.json();
    const modeRaw = String(body.costConversionMode || "").trim();
    if (modeRaw !== "manual" && modeRaw !== "live") {
      return NextResponse.json(
        { error: 'costConversionMode must be "manual" or "live"' },
        { status: 400 }
      );
    }
    await setCostConversionMode(modeRaw as CostConversionMode);
    const snapshot = await getCostConversionSnapshot(new Date());
    return NextResponse.json({
      costConversionMode: snapshot.mode,
      appliedRate: snapshot.appliedRate,
      reportingRate: snapshot.reportingRate,
      storedLiveRate: snapshot.liveRate,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
