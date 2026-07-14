import fs from "node:fs";
import path from "node:path";
import { getBestAddressFromFields } from "@/lib/address-display";
import { normalizeAddress } from "@/lib/geo/store";
import { prisma } from "@/lib/prisma";

type GeocacheFile = Record<string, { lat?: number; lng?: number; displayName?: string }>;

function loadGeocacheFile(): GeocacheFile {
  const cachePath = path.join(process.cwd(), "data", "geocache.json");
  try {
    const raw = fs.readFileSync(cachePath, "utf8");
    const j = JSON.parse(raw) as GeocacheFile;
    return typeof j === "object" && j ? j : {};
  } catch {
    return {};
  }
}

/** Apply data/geocache.json coordinates to architect rows (by normalized address). */
export async function applyGeocacheToArchitects(): Promise<number> {
  const geocache = loadGeocacheFile();
  if (Object.keys(geocache).length === 0) return 0;

  const rows = await prisma.architect.findMany({
    where: { OR: [{ latitude: null }, { longitude: null }] },
    select: { id: true, address: true, description: true },
  });

  let updated = 0;
  for (const row of rows) {
    const addr = getBestAddressFromFields(row.address ?? "", row.description ?? "");
    if (!addr) continue;
    const hit = geocache[normalizeAddress(addr)];
    if (hit?.lat == null || hit?.lng == null) continue;
    const lat = Number(hit.lat);
    const lng = Number(hit.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    await prisma.architect.update({
      where: { id: row.id },
      data: { latitude: lat, longitude: lng, geocodedAt: new Date() },
    });
    updated++;
  }
  return updated;
}
