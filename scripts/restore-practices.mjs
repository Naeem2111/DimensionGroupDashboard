/**
 * Restore marketing practices (architects + lead pipeline rows) from repo JSON.
 * Does not touch users, ops clients, or planner data.
 *
 * Usage: node scripts/restore-practices.mjs --confirm
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const root = process.cwd();

function readJsonSafe(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

async function seedArchitects() {
  const architects = readJsonSafe(path.join(root, "architects.json"), []);
  if (!Array.isArray(architects) || architects.length === 0) {
    console.error("architects.json missing or empty");
    return 0;
  }

  const rows = architects
    .map((item) => {
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
        description: item?.description ? String(item.description) : null,
        yearsActive: item?.years_active ? String(item.years_active) : null,
        staff: item?.staff ? String(item.staff) : null,
        awards: Array.isArray(item?.awards) ? item.awards.map(String) : [],
        latitude: item?.latitude != null ? Number(item.latitude) : null,
        longitude: item?.longitude != null ? Number(item.longitude) : null,
      };
    })
    .filter(Boolean);

  await prisma.architect.deleteMany();
  await prisma.architect.createMany({ data: rows, skipDuplicates: true });
  return rows.length;
}

async function seedLeads() {
  const leads = readJsonSafe(path.join(root, "data", "leads.json"), {});
  if (!leads || typeof leads !== "object") {
    console.error("data/leads.json missing or invalid");
    return 0;
  }

  const rows = [];
  for (const [architectUrl, lead] of Object.entries(leads)) {
    if (!architectUrl || typeof lead !== "object" || !lead) continue;
    const stage = String(lead.stage || "cold");
    const mappedStage = [
      "cold",
      "no_reply",
      "positive_reply",
      "follow_up_interested",
      "negative_reply",
      "follow_up_not_interested",
    ].includes(stage)
      ? stage
      : "cold";
    const ratingRaw = Number(lead.rating ?? 0);
    const rating = Number.isFinite(ratingRaw) ? Math.max(0, Math.min(5, Math.round(ratingRaw))) : 0;
    const lastEmailedAt =
      typeof lead.lastEmailedAt === "string" && lead.lastEmailedAt.trim()
        ? new Date(lead.lastEmailedAt)
        : null;

    rows.push({
      architectUrl,
      stage: mappedStage,
      rating,
      notes: typeof lead.notes === "string" ? lead.notes : null,
      lastEmailedAt,
    });
  }

  if (rows.length === 0) return 0;
  await prisma.lead.deleteMany();
  await prisma.lead.createMany({ data: rows, skipDuplicates: true });
  return rows.length;
}

/** One cold lead per practice (matches outreach DB before wipe). */
async function seedDefaultLeadsForAllArchitects() {
  const architects = await prisma.architect.findMany({ select: { url: true } });
  const existing = new Set(
    (await prisma.lead.findMany({ select: { architectUrl: true } })).map((r) => r.architectUrl)
  );
  const missing = architects
    .filter((a) => !existing.has(a.url))
    .map((a) => ({
      architectUrl: a.url,
      stage: "cold",
      rating: 0,
    }));

  if (missing.length === 0) return 0;
  const batch = 500;
  for (let i = 0; i < missing.length; i += batch) {
    await prisma.lead.createMany({
      data: missing.slice(i, i + batch),
      skipDuplicates: true,
    });
  }
  return missing.length;
}

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.error("Refusing without --confirm");
    console.error("Example: node scripts/restore-practices.mjs --confirm");
    process.exit(1);
  }

  console.log("Restoring practices from architects.json + data/leads.json …");
  const architects = await seedArchitects();
  const trackedLeads = await seedLeads();
  const defaultLeads = await seedDefaultLeadsForAllArchitects();
  const totalLeads = await prisma.lead.count();
  const withCoords = await prisma.architect.count({
    where: { latitude: { not: null }, longitude: { not: null } },
  });

  console.log(`Architects: ${architects}`);
  console.log(`Tracked leads (from data/leads.json): ${trackedLeads}`);
  console.log(`Default cold leads added: ${defaultLeads}`);
  console.log(`Total lead records: ${totalLeads}`);
  console.log(`With map coordinates: ${withCoords}`);
  if (withCoords < architects) {
    console.log(
      "\nMap pins: run `npm run geocode:architects` to backfill coordinates (was ~786 before wipe)."
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
