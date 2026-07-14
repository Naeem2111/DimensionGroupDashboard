import { NextRequest } from "next/server";
import { geocodeWithFallback } from "@/lib/geo/nominatim";
import { getCachedGeocode } from "@/lib/geo/store";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = (searchParams.get("address") || "").trim();
  if (!address) {
    return Response.json({ error: "Missing address" }, { status: 400 });
  }

  const cached = getCachedGeocode(address);
  if (cached) {
    return Response.json({ address, ...cached, cached: true });
  }

  const point = await geocodeWithFallback(address);
  if (!point) {
    return Response.json({ address, found: false }, { status: 404 });
  }

  return Response.json({ address, ...point, cached: false });
}

