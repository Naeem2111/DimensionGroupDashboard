import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import { randomBytes, scryptSync } from "node:crypto";

const prisma = new PrismaClient();
const root = process.cwd();

function hashPasswordScrypt(plain) {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, 32, { N: 16384, r: 8, p: 1 });
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

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

async function seedArchitects() {
  const architectsPath = path.join(root, "architects.json");
  const architects = readJsonSafe(architectsPath, []);
  if (!Array.isArray(architects) || architects.length === 0) return 0;

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
      };
    })
    .filter(Boolean);

  if (rows.length === 0) return 0;
  await prisma.architect.deleteMany();
  await prisma.architect.createMany({ data: rows, skipDuplicates: true });
  return rows.length;
}

async function seedLeads() {
  const leadsPath = path.join(root, "data", "leads.json");
  const leads = readJsonSafe(leadsPath, {});
  if (!leads || typeof leads !== "object") return 0;

  const rows = [];
  for (const [architectUrl, lead] of Object.entries(leads)) {
    if (!architectUrl || typeof lead !== "object" || !lead) continue;
    const l = lead;
    const stage = String(l.stage || "cold");
    const mappedStage =
      [
        "cold",
        "no_reply",
        "positive_reply",
        "follow_up_interested",
        "negative_reply",
        "follow_up_not_interested",
      ].includes(stage)
        ? stage
        : "cold";
    const ratingRaw = Number(l.rating ?? 0);
    const rating = Number.isFinite(ratingRaw) ? Math.max(0, Math.min(5, Math.round(ratingRaw))) : 0;
    const lastEmailedAt =
      typeof l.lastEmailedAt === "string" && l.lastEmailedAt.trim() ? new Date(l.lastEmailedAt) : null;

    rows.push({
      architectUrl,
      stage: mappedStage,
      rating,
      notes: typeof l.notes === "string" ? l.notes : null,
      lastEmailedAt,
    });
  }
  if (rows.length === 0) return 0;
  await prisma.lead.deleteMany();
  await prisma.lead.createMany({ data: rows, skipDuplicates: true });
  return rows.length;
}

async function seedUsers() {
  const usersPath = path.join(root, "data", "users.json");
  const usersData = readJsonSafe(usersPath, { users: [] });
  const users = Array.isArray(usersData?.users) ? usersData.users : [];

  const rows = [];
  for (const user of users) {
    const username = String(user?.username || "").trim().toLowerCase();
    if (!username) continue;
    rows.push({
      id: user?.id ? String(user.id) : crypto.randomUUID(),
      username,
      passwordHash: String(user?.passwordHash || ""),
      role: user?.role === "admin" ? "admin" : "user",
      disabled: Boolean(user?.disabled),
      createdAt: user?.createdAt ? new Date(user.createdAt) : new Date(),
    });
  }

  if (rows.length === 0) {
    await prisma.user.deleteMany();
    await prisma.user.create({
      data: {
        username: "blocharch",
        passwordHash: hashPassword("blocharch"),
        role: "admin",
        disabled: false,
      },
    });
    return 1;
  }

  await prisma.user.deleteMany();
  await prisma.user.createMany({ data: rows, skipDuplicates: true });
  return rows.length;
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
        blocharchStartDate: new Date("2025-01-01"),
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
  const leads = await seedLeads();
  const users = await seedUsers();
  const ops = await seedOpsDemo();
  console.log(`Seed complete. architects=${architects} leads=${leads} users=${users} ops=${JSON.stringify(ops)}`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
