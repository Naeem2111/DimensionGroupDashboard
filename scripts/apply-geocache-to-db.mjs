/**
 * Apply data/geocache.json lat/lng to architect rows.
 * Usage: node scripts/apply-geocache-to-db.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const root = process.cwd();

function normalizeAddress(address) {
  return String(address || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function getBestAddressFromFields(address, description) {
  const direct = String(address || "").trim();
  if (direct) return direct;
  const desc = String(description || "").trim();
  if (!desc) return null;
  const m = desc.match(
    /\bAddresses?\b\s+([\s\S]*?)(?=\bContact\b|\bEmail\b|\bWebsite\b|\bTwitter\b|\bInstagram\b|\bLinkedIn\b|\bFacebook\b|\bBack to Results\b|$)/i
  );
  if (!m?.[1]) return null;
  const extracted = m[1].replace(/\s+/g, " ").trim();
  if (!extracted) return null;
  return extracted.length > 160 ? extracted.slice(0, 160) : extracted;
}

function loadGeocache() {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, "data", "geocache.json"), "utf8"));
  } catch {
    return {};
  }
}

async function main() {
  const geocache = loadGeocache();
  const rows = await prisma.architect.findMany({
    where: { OR: [{ latitude: null }, { longitude: null }] },
    select: { id: true, address: true, description: true },
  });

  let updated = 0;
  for (const row of rows) {
    const addr = getBestAddressFromFields(row.address, row.description);
    if (!addr) continue;
    const hit = geocache[normalizeAddress(addr)];
    if (hit?.lat == null || hit?.lng == null) continue;
    await prisma.architect.update({
      where: { id: row.id },
      data: {
        latitude: Number(hit.lat),
        longitude: Number(hit.lng),
        geocodedAt: new Date(),
      },
    });
    updated++;
  }
  const total = await prisma.architect.count({
    where: { latitude: { not: null }, longitude: { not: null } },
  });
  console.log(`Geocache applied: ${updated} rows. Total with coordinates: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
