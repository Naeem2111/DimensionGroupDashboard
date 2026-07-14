/**
 * Fast UK pin backfill via postcodes.io bulk API (~100 postcodes/request).
 * Uses postcode centroids — good enough for map pins when street geocoding is slow.
 *
 * Usage:
 *   node scripts/geocode-architects-bulk.mjs [--dry-run] [--fallback-nominatim]
 *
 * Typical runtime: a few minutes for ~1k+ pending rows (vs hours on Nominatim).
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  compactUkPostcode,
  formatUkPostcode,
  getBestAddressFromFields,
  primaryUkPostcode,
} from "../lib/geo/geocode-candidates.mjs";

const root = process.cwd();
const BATCH_SIZE = 100;
const BATCH_PAUSE_MS = 250;

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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * @param {string[]} postcodes formatted like "SE1 0JF"
 * @returns {Promise<Map<string, { lat: number; lng: number; postcode: string }>>}
 */
async function bulkLookupPostcodes(postcodes) {
  const url = "https://api.postcodes.io/postcodes?filter=postcode,latitude,longitude";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ postcodes }),
  });
  if (!res.ok) {
    throw new Error(`postcodes.io bulk failed: HTTP ${res.status}`);
  }
  const json = await res.json();
  const hits = new Map();
  for (const row of json?.result ?? []) {
    const r = row?.result;
    if (!r?.latitude || !r?.longitude || !r?.postcode) continue;
    const key = compactUkPostcode(r.postcode);
    hits.set(key, {
      lat: Number(r.latitude),
      lng: Number(r.longitude),
      postcode: r.postcode,
    });
  }
  return hits;
}

/**
 * District-level fallback when full postcode is missing/invalid (e.g. "SE1").
 * @param {string} outcode
 */
async function lookupOutcode(outcode) {
  const res = await fetch(
    `https://api.postcodes.io/outcodes/${encodeURIComponent(outcode)}`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) return null;
  const json = await res.json();
  const r = json?.result;
  if (!r?.latitude || !r?.longitude) return null;
  return {
    lat: Number(r.latitude),
    lng: Number(r.longitude),
    postcode: outcode,
  };
}

loadEnvFile();
const dryRun = process.argv.includes("--dry-run");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.architect.findMany({
    where: { OR: [{ latitude: null }, { longitude: null }] },
    select: { id: true, name: true, address: true, description: true },
    orderBy: { name: "asc" },
  });

  /** @type {Map<string, { postcode: string; architectIds: string[] }>} */
  const byPostcode = new Map();
  const noPostcode = [];

  for (const row of rows) {
    const addr = getBestAddressFromFields(row.address, row.description);
    if (!addr?.trim()) continue;
    const pc = primaryUkPostcode(addr);
    if (!pc) {
      noPostcode.push(row);
      continue;
    }
    const key = compactUkPostcode(pc);
    const formatted = formatUkPostcode(pc);
    const bucket = byPostcode.get(key) ?? { postcode: formatted, architectIds: [] };
    bucket.architectIds.push(row.id);
    byPostcode.set(key, bucket);
  }

  const uniquePostcodes = [...byPostcode.values()].map((b) => b.postcode);
  console.log(
    `Pending rows: ${rows.length} · with postcode: ${uniquePostcodes.length} unique postcodes · no postcode: ${noPostcode.length}`
  );

  let updated = 0;
  let resolvedPostcodes = 0;
  const missedPostcodes = [];

  for (const batch of chunk(uniquePostcodes, BATCH_SIZE)) {
    const hits = await bulkLookupPostcodes(batch);
    for (const formatted of batch) {
      const key = compactUkPostcode(formatted);
      let point = hits.get(key);
      if (!point) {
        const outcode = formatted.split(" ")[0];
        point = outcode ? await lookupOutcode(outcode) : null;
        await sleep(80);
      }
      if (!point) {
        missedPostcodes.push(formatted);
        continue;
      }
      resolvedPostcodes += 1;
      const bucket = byPostcode.get(key);
      if (!bucket) continue;

      for (const architectId of bucket.architectIds) {
        if (dryRun) {
          updated += 1;
          continue;
        }
        await prisma.architect.update({
          where: { id: architectId },
          data: {
            latitude: point.lat,
            longitude: point.lng,
            geocodedAt: new Date(),
          },
        });
        updated += 1;
      }
    }
    console.log(`… batch done · ${updated} rows written so far`);
    await sleep(BATCH_PAUSE_MS);
  }

  const total = await prisma.architect.count({
    where: { latitude: { not: null }, longitude: { not: null } },
  });

  console.log(
    JSON.stringify(
      {
        rowsWritten: updated,
        postcodesResolved: resolvedPostcodes,
        postcodesMissed: missedPostcodes.length,
        noPostcodeRows: noPostcode.length,
        dbTotalWithCoords: total,
        dryRun,
      },
      null,
      2
    )
  );

  if (noPostcode.length > 0) {
    console.log(
      `Still need Nominatim for ${noPostcode.length} rows without a UK postcode: node scripts/geocode-architects.mjs --all`
    );
  }
  if (missedPostcodes.length > 0) {
    console.log(`Missed postcodes (sample): ${missedPostcodes.slice(0, 8).join(", ")}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
