import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import { randomBytes, scryptSync } from "node:crypto";

const prisma = new PrismaClient();
const root = process.cwd();

/** Same format as lib/password.ts — login only accepts scrypt$… */
function hashPasswordScrypt(plain) {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

function readJsonSafe(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

const VALID_ROLES = new Set(["admin", "manager", "user"]);

/** Known local/dev accounts (password: changeme for all). */
const DEFAULT_USERS = [
  { username: "admin", password: "changeme", role: "admin" },
  { username: "manager", password: "changeme", role: "manager" },
  { username: "staff", password: "changeme", role: "user" },
];

function normalizeRole(role) {
  const r = String(role || "user").toLowerCase();
  return VALID_ROLES.has(r) ? r : "user";
}

function architectsJsonPath() {
  const fromArg = process.argv.find((a) => a.startsWith("--architects="));
  if (fromArg) return path.resolve(root, fromArg.slice("--architects=".length));
  const sample = path.join(root, "data", "architects-sample.json");
  if (process.argv.includes("--sample") && fs.existsSync(sample)) return sample;
  return path.join(root, "architects.json");
}

async function seedArchitects() {
  const architectsPath = architectsJsonPath();
  const architects = readJsonSafe(architectsPath, []);
  if (!Array.isArray(architects) || architects.length === 0) {
    console.warn(`No architects found at ${architectsPath}`);
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
        latitude: item?.latitude != null && Number.isFinite(Number(item.latitude)) ? Number(item.latitude) : null,
        longitude:
          item?.longitude != null && Number.isFinite(Number(item.longitude)) ? Number(item.longitude) : null,
      };
    })
    .filter(Boolean);

  if (rows.length === 0) return 0;

  const replace = process.argv.includes("--replace-architects");
  if (replace) {
    await prisma.architect.deleteMany();
    await prisma.architect.createMany({ data: rows, skipDuplicates: true });
  } else {
    for (const row of rows) {
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
          description: row.description,
          yearsActive: row.yearsActive,
          staff: row.staff,
          awards: row.awards,
          ...(row.latitude != null ? { latitude: row.latitude } : {}),
          ...(row.longitude != null ? { longitude: row.longitude } : {}),
        },
      });
    }
  }
  console.log(`Architects from ${path.relative(root, architectsPath)}: ${rows.length}`);
  return rows.length;
}

async function seedLeads() {
  const leadsPath = path.join(root, "data", "leads.json");
  const leads = readJsonSafe(leadsPath, {});
  if (!leads || typeof leads !== "object") return 0;

  let upserted = 0;
  for (const [architectUrl, lead] of Object.entries(leads)) {
    if (!architectUrl || typeof lead !== "object" || !lead) continue;
    const architect = await prisma.architect.findUnique({ where: { url: architectUrl } });
    if (!architect) continue;

    const stage = String(lead.stage || "cold");
    const mappedStage = [
      "cold",
      "targeted",
      "first_email_sent",
      "follow_up_due",
      "follow_up_sent",
      "reply_received",
      "positive_reply",
      "interested",
      "client_onboarded",
      "negative_reply",
      "not_interested",
      "no_reply",
      "follow_up_interested",
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

    await prisma.lead.upsert({
      where: { architectUrl },
      create: {
        architectUrl,
        stage: mappedStage,
        rating,
        notes: typeof lead.notes === "string" ? lead.notes : null,
        lastEmailedAt,
      },
      update: {
        stage: mappedStage,
        rating,
        notes: typeof lead.notes === "string" ? lead.notes : null,
        lastEmailedAt,
      },
    });
    upserted += 1;
  }
  return upserted;
}

/** Ensure every practice has a cold lead row. */
async function seedDefaultLeadsForAllArchitects() {
  const architects = await prisma.architect.findMany({ select: { url: true } });
  const existing = new Set(
    (await prisma.lead.findMany({ select: { architectUrl: true } })).map((r) => r.architectUrl)
  );
  const missing = architects
    .filter((a) => !existing.has(a.url))
    .map((a) => ({ architectUrl: a.url, stage: "cold", rating: 0 }));

  if (missing.length === 0) return 0;
  const batch = 500;
  for (let i = 0; i < missing.length; i += batch) {
    await prisma.lead.createMany({ data: missing.slice(i, i + batch), skipDuplicates: true });
  }
  return missing.length;
}

async function seedUsers() {
  let created = 0;
  let updated = 0;

  // Optional hashed imports from data/users.json (do not wipe existing accounts).
  const usersPath = path.join(root, "data", "users.json");
  const usersData = readJsonSafe(usersPath, { users: [] });
  const users = Array.isArray(usersData?.users) ? usersData.users : [];

  for (const user of users) {
    const username = String(user?.username || "").trim().toLowerCase();
    const passwordHash = String(user?.passwordHash || "");
    if (!username || !passwordHash.startsWith("scrypt$")) continue;

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) continue;

    await prisma.user.create({
      data: {
        id: user?.id ? String(user.id) : crypto.randomUUID(),
        username,
        passwordHash,
        role: normalizeRole(user?.role),
        disabled: Boolean(user?.disabled),
        createdAt: user?.createdAt ? new Date(user.createdAt) : new Date(),
      },
    });
    created += 1;
  }

  // Always ensure known default accounts (scrypt, login-ready).
  for (const def of DEFAULT_USERS) {
    const passwordHash = hashPasswordScrypt(def.password);
    const existing = await prisma.user.findUnique({ where: { username: def.username } });
    if (existing) {
      await prisma.user.update({
        where: { username: def.username },
        data: { passwordHash, role: def.role, disabled: false },
      });
      updated += 1;
    } else {
      await prisma.user.create({
        data: {
          username: def.username,
          passwordHash,
          role: def.role,
          disabled: false,
        },
      });
      created += 1;
    }
  }

  console.log(
    `Default logins: admin / changeme, manager / changeme, staff / changeme (created=${created} updated=${updated})`
  );
  return created + updated;
}

async function seedOpsDemo() {
  const existing = await prisma.opsClient.count();
  if (existing > 0) return { skipped: true };

  const admin = await prisma.user.findFirst({ where: { role: "admin" } });
  if (!admin) return { skipped: true, reason: "no admin user" };

  const athleteUserId = crypto.randomUUID();
  const athlete = await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        id: athleteUserId,
        username: "athlete01",
        passwordHash: hashPasswordScrypt("athlete01"),
        role: "user",
        disabled: false,
      },
    });

    const client = await tx.opsClient.create({
      data: {
        name: "Demo Client Ltd",
        companyName: "Demo Client Ltd",
        software: "Revit, AutoCAD",
        country: "UK",
        contacts: {
          create: [{ name: "Jane Client", email: "client@example.com", sortOrder: 0 }],
        },
        commercial: {
          create: {
            pricingTier: "tier_30",
            laneCostGbp: 2041,
            activeLaneCount: 1,
          },
        },
      },
    });

    const athleteProfile = await tx.opsAthlete.create({
      data: {
        userId: athleteUserId,
        fullName: "Athlete 01",
        athleteCode: "ATH-01",
        email: "athlete01@example.com",
        memberStartDate: new Date("2025-01-01"),
        baseMonthlyPayZar: 20000,
        monthlyHourCap: 160,
        overtimeRateZar: 200,
      },
    });

    await tx.opsProject.createMany({
      data: [
        {
          clientId: client.id,
          assignedAthleteId: athleteProfile.id,
          name: "1692 24 Stevenage Road",
          projectNumber: "1692-24",
          address: "24 Stevenage Road, London",
          projectLead: "Jethro",
          complexity: "medium",
          currentStage: "existing_drawings",
          currentStatus: "in_progress",
          dueDate: new Date("2026-06-30"),
        },
        {
          clientId: client.id,
          assignedAthleteId: athleteProfile.id,
          name: "1716 20 Baker Street",
          projectNumber: "1716-20",
          address: "20 Baker Street, London",
          projectLead: "Jethro",
          complexity: "high",
          currentStage: "proposed_drawings",
          currentStatus: "not_started",
          dueDate: new Date("2026-08-15"),
        },
      ],
    });

    return athleteProfile;
  });

  return { skipped: false, athleteCode: athlete.athleteCode, username: "athlete01" };
}

async function main() {
  const architects = await seedArchitects();
  const trackedLeads = await seedLeads();
  const defaultLeads = await seedDefaultLeadsForAllArchitects();
  const users = await seedUsers();
  const ops = await seedOpsDemo();
  const totalLeads = await prisma.lead.count();
  console.log(
    `Seed complete. architects=${architects} trackedLeads=${trackedLeads} defaultColdLeads=${defaultLeads} totalLeads=${totalLeads} users=${users} ops=${JSON.stringify(ops)}`
  );
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
