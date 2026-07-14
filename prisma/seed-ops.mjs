import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import { randomBytes, scryptSync } from "node:crypto";

const prisma = new PrismaClient();

function hashPasswordScrypt(plain) {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

async function main() {
  const existing = await prisma.opsClient.count();
  if (existing > 0) {
    console.log("Ops seed skipped — clients already exist.");
    return;
  }

  const athleteUserId = crypto.randomUUID();
  await prisma.$transaction(async (tx) => {
    const userExists = await tx.user.findUnique({ where: { username: "athlete01" } });
    if (!userExists) {
      await tx.user.create({
        data: {
          id: athleteUserId,
          username: "athlete01",
          passwordHash: hashPasswordScrypt("athlete01"),
          role: "user",
          disabled: false,
        },
      });
    }

    const userId = userExists?.id ?? athleteUserId;

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

    let athleteProfile = await tx.opsAthlete.findUnique({ where: { userId } });
    if (!athleteProfile) {
      athleteProfile = await tx.opsAthlete.create({
        data: {
          userId,
          fullName: "Athlete 01",
          athleteCode: "ATH-01",
          email: "athlete01@example.com",
          blocharchStartDate: new Date("2025-01-01"),
        },
      });
    }

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
  });

  console.log("Ops demo seeded. Login: athlete01 / athlete01");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
