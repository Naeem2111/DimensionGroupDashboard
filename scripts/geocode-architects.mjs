/**
 * One-time / periodic backfill: geocode architect addresses and store lat/lng on each row
 * so the map loads instantly without client-side Nominatim churn.
 *
 * Usage: node scripts/geocode-architects.mjs [--limit=500] [--all] [--dry-run]
 *   --all     Geocode every practice that has an address (no row limit).
 * Requires DATABASE_URL (load from .env in project root).
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  buildGeocodeQueries,
  getBestAddressFromFields,
  primaryUkPostcode,
  formatUkPostcode,
} from "../lib/geo/geocode-candidates.mjs";

const root = process.cwd();

function loadEnvFile() {
  try {
    const envPath = path.join(root, ".env");
    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      const key = t.slice(0, i).trim();
      let val = t.slice(i + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    /* no .env */
  }
}

function normalizeAddress(addr) {
  return String(addr || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const cachePath = path.join(root, "data", "geocache.json");

function loadGeocache() {
  try {
    const raw = fs.readFileSync(cachePath, "utf8");
    const j = JSON.parse(raw);
    return typeof j === "object" && j ? j : {};
  } catch {
    return {};
  }
}

function saveGeocache(cache) {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf8");
}

function getUserAgent() {
  return (
    process.env.GEOCODER_USER_AGENT ||
    "blocarch-dashboard (geocode-architects.mjs) - set GEOCODER_USER_AGENT"
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function nominatimSearch(query, { countrycodes } = {}) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", query);
  if (countrycodes) url.searchParams.set("countrycodes", countrycodes);

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": getUserAgent(),
      "Accept-Language": "en",
    },
  });
  if (!res.ok) return null;
  const json = await res.json();
  const first = Array.isArray(json) ? json[0] : null;
  if (!first?.lat || !first?.lon) return null;
  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, displayName: first.display_name };
}

async function geocodeWithFallback(address, practiceName, { postcodeOnly = false } = {}) {
  if (postcodeOnly) {
    const pc = primaryUkPostcode(address);
    if (!pc) return null;
    const queries = [
      `${formatUkPostcode(pc)}, United Kingdom`,
      formatUkPostcode(pc),
    ];
    for (let i = 0; i < queries.length; i++) {
      let point = await nominatimSearch(queries[i], { countrycodes: "gb" });
      if (!point) {
        await sleep(1100);
        point = await nominatimSearch(queries[i]);
      }
      if (point) return point;
      if (i < queries.length - 1) await sleep(1100);
    }
    return null;
  }

  const queries = buildGeocodeQueries(address, practiceName);
  for (let i = 0; i < queries.length; i++) {
    let point = await nominatimSearch(queries[i], { countrycodes: "gb" });
    if (!point) {
      await sleep(1100);
      point = await nominatimSearch(queries[i]);
    }
    if (point) return point;
    if (i < queries.length - 1) await sleep(1100);
  }
  return null;
}

function parseArgs() {
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const all = process.argv.includes("--all");
  const limit = limitArg
    ? Math.max(1, parseInt(limitArg.split("=")[1], 10) || 0)
    : all
      ? null
      : null;
  const dryRun = process.argv.includes("--dry-run");
  const postcodeOnly = process.argv.includes("--postcode-only");
  return { limit, all, dryRun, postcodeOnly };
}

loadEnvFile();
const { limit, all, dryRun, postcodeOnly } = parseArgs();
const prisma = new PrismaClient();
const geocache = loadGeocache();
let cacheDirty = false;

async function main() {
  if (all) {
    console.log(
      postcodeOnly
        ? "Mode: postcode-only Nominatim (~1 req/s)."
        : "Mode: geocode all practices with addresses (postcode fallbacks; ~1 req/s)."
    );
  }

  const rows = await prisma.architect.findMany({
    where: {
      OR: [{ latitude: null }, { longitude: null }],
    },
    select: {
      id: true,
      url: true,
      name: true,
      address: true,
      description: true,
    },
    orderBy: { name: "asc" },
  });

  let done = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    if (limit != null && updated >= limit) break;

    const addr = getBestAddressFromFields(row.address, row.description);
    if (!addr?.trim()) {
      skipped += 1;
      continue;
    }

    const key = normalizeAddress(addr);
    let point = null;
    const cached = key ? geocache[key] : null;
    if (cached?.lat != null && cached?.lng != null) {
      point = { lat: Number(cached.lat), lng: Number(cached.lng), displayName: cached.displayName };
    } else {
      console.log(`[nominatim] ${row.name.slice(0, 40)}…`);
      point = await geocodeWithFallback(addr, row.name, { postcodeOnly });
      if (point && key) {
        geocache[key] = {
          lat: point.lat,
          lng: point.lng,
          displayName: point.displayName,
          updatedAt: new Date().toISOString(),
        };
        cacheDirty = true;
      }
    }

    if (!point) {
      skipped += 1;
      continue;
    }

    done += 1;
    if (dryRun) {
      console.log(`[dry-run] would set ${addr.slice(0, 50)} → ${point.lat}, ${point.lng}`);
      updated += 1;
      continue;
    }

    await prisma.architect.update({
      where: { id: row.id },
      data: {
        latitude: point.lat,
        longitude: point.lng,
        geocodedAt: new Date(),
      },
    });
    updated += 1;
    if (updated % 25 === 0) {
      if (cacheDirty) {
        saveGeocache(geocache);
        cacheDirty = false;
      }
      const total = await prisma.architect.count({
        where: { latitude: { not: null }, longitude: { not: null } },
      });
      console.log(`… ${updated} rows this run · ${total} total with coordinates in DB`);
    }
  }

  if (cacheDirty) saveGeocache(geocache);

  const total = await prisma.architect.count({
    where: { latitude: { not: null }, longitude: { not: null } },
  });
  console.log(
    `Done. Geocoded: ${done}, rows written: ${updated}, skipped (no address / failed): ${skipped}, DB total with coords: ${total}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
