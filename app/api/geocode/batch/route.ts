import { NextRequest } from "next/server";
import { getBestAddressFromFields } from "@/lib/address-display";
import { geocodeWithFallback } from "@/lib/geo/nominatim";
import { getCachedGeocode, normalizeAddress } from "@/lib/geo/store";
import { prisma } from "@/lib/prisma";

/** Vercel / long-running: uncached Nominatim calls use postcode fallbacks (~1.1s each). */
export const maxDuration = 60;

async function buildAddressContextMap(): Promise<
  Map<string, { id: string; name: string }>
> {
  const map = new Map<string, { id: string; name: string }>();
  const rows = await prisma.architect.findMany({
    where: { OR: [{ latitude: null }, { longitude: null }] },
    select: { id: true, name: true, address: true, description: true },
  });
  for (const row of rows) {
    const addr = getBestAddressFromFields(row.address ?? "", row.description ?? "");
    if (!addr) continue;
    map.set(normalizeAddress(addr), { id: row.id, name: row.name });
  }
  return map;
}

async function persistGeocodeToDb(
  address: string,
  point: { lat: number; lng: number },
  ctxByAddress: Map<string, { id: string; name: string }>
) {
  const ctx = ctxByAddress.get(normalizeAddress(address));
  if (!ctx) return;
  await prisma.architect.update({
    where: { id: ctx.id },
    data: {
      latitude: point.lat,
      longitude: point.lng,
      geocodedAt: new Date(),
    },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const addresses = Array.isArray(body.addresses) ? (body.addresses as string[]) : [];
  const limit = Math.min(200, Math.max(1, Number(body.limit ?? 50)));
  const persist = body.persist !== false;

  const unique = Array.from(
    new Set(addresses.map((a) => (typeof a === "string" ? a.trim() : "")).filter(Boolean))
  ).slice(0, limit);

  const results: Record<string, { lat: number; lng: number; displayName?: string; cached: boolean }> = {};
  const missing: string[] = [];
  const ctxByAddress = persist ? await buildAddressContextMap() : new Map();

  for (const addr of unique) {
    const cached = getCachedGeocode(addr);
    if (cached) {
      results[addr] = { ...cached, cached: true };
      if (persist) await persistGeocodeToDb(addr, cached, ctxByAddress);
      continue;
    }
    const ctx = ctxByAddress.get(normalizeAddress(addr));
    const point = await geocodeWithFallback(addr, {
      practiceName: ctx?.name,
      sleepMs: 1100,
    });
    if (!point) {
      missing.push(addr);
    } else {
      results[addr] = { ...point, cached: false };
      if (persist) await persistGeocodeToDb(addr, point, ctxByAddress);
    }
  }

  return Response.json({ results, missing, count: unique.length });
}

