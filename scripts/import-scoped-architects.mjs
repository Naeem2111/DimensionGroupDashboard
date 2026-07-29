/**
 * Upsert scraped practices + cold leads.
 * Scope helpers match Dimension Group ICP: staff 0-4 / 5-19 with email.
 *
 * Usage:
 *   node scripts/import-scoped-architects.mjs data/architects-sme.json
 *   node scripts/import-scoped-architects.mjs architects.json --from-full --limit 250
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const root = process.cwd();
const SME_STAFF = new Set(["0 - 4", "5 - 19"]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function normalizeStaff(raw) {
  return String(raw || "")
    .split(/\s+/)
    .join(" ")
    .trim();
}

function toRow(item) {
  const url = String(item?.url || "").trim();
  if (!url) return null;
  return {
    url,
    name: String(item?.name || ""),
    website: item?.website ? String(item.website) : null,
    socials: Array.isArray(item?.socials) ? item.socials.map(String) : [],
    email: item?.email ? String(item.email) : null,
    address: item?.address ? String(item.address) : null,
    contact: item?.contact ? String(item.contact) : null,
    phone: item?.phone ? String(item.phone) : null,
    country: item?.country ? String(item.country) : null,
    description: item?.description ? String(item.description) : null,
    yearsActive: item?.years_active ? String(item.years_active) : null,
    staff: item?.staff ? String(item.staff) : null,
    awards: Array.isArray(item?.awards) ? item.awards.map(String) : [],
    latitude: item?.latitude != null && Number.isFinite(Number(item.latitude)) ? Number(item.latitude) : null,
    longitude:
      item?.longitude != null && Number.isFinite(Number(item.longitude)) ? Number(item.longitude) : null,
  };
}

function fitsSme(row) {
  if (!row?.email) return false;
  return SME_STAFF.has(normalizeStaff(row.staff));
}

async function main() {
  const args = process.argv.slice(2);
  const fromFull = args.includes("--from-full");
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.slice("--limit=".length)) : null;
  const fileArg = args.find((a) => !a.startsWith("--"));
  const filePath = path.resolve(root, fileArg || (fromFull ? "architects.json" : "data/architects-sme.json"));

  if (!fs.existsSync(filePath)) {
    console.error(`Missing ${filePath}`);
    process.exit(1);
  }

  let items = readJson(filePath);
  if (!Array.isArray(items)) {
    console.error("Expected a JSON array of practices");
    process.exit(1);
  }

  if (fromFull) {
    items = items.filter((item) => {
      const row = toRow(item);
      return row && fitsSme(row);
    });
    console.log(`Filtered full scrape to ${items.length} SME practices with email`);
  }

  if (limit && Number.isFinite(limit) && limit > 0) {
    items = items.slice(0, limit);
  }

  const existing = new Set(
    (await prisma.architect.findMany({ select: { url: true } })).map((a) => a.url)
  );

  let created = 0;
  let updated = 0;
  let leadsCreated = 0;

  for (const item of items) {
    if (item?.error) continue;
    const row = toRow(item);
    if (!row) continue;

    const before = existing.has(row.url);
    await prisma.architect.upsert({
      where: { url: row.url },
      create: row,
      update: {
        name: row.name,
        website: row.website,
        socials: row.socials,
        email: row.email,
        address: row.address,
        contact: row.contact,
        phone: row.phone,
        country: row.country,
        description: row.description,
        yearsActive: row.yearsActive,
        staff: row.staff,
        awards: row.awards,
        ...(row.latitude != null ? { latitude: row.latitude } : {}),
        ...(row.longitude != null ? { longitude: row.longitude } : {}),
      },
    });
    if (before) updated += 1;
    else {
      created += 1;
      existing.add(row.url);
    }

    const lead = await prisma.lead.findUnique({ where: { architectUrl: row.url } });
    if (!lead) {
      await prisma.lead.create({
        data: { architectUrl: row.url, stage: "cold", rating: 0 },
      });
      leadsCreated += 1;
    }
  }

  const total = await prisma.architect.count();
  const byCountry = await prisma.architect.groupBy({
    by: ["country"],
    _count: { _all: true },
  });
  console.log(
    JSON.stringify(
      {
        file: path.relative(root, filePath),
        created,
        updated,
        leadsCreated,
        totalArchitects: total,
        byCountry: Object.fromEntries(
          byCountry.map((r) => [r.country || "(unset)", r._count._all])
        ),
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
