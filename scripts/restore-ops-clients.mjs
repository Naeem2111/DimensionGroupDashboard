/**

 * Restore ops clients from JSON (created by export-ops-clients.mjs).

 * Usage: node scripts/restore-ops-clients.mjs [in-file] [--confirm]

 */

import fs from "node:fs";

import path from "node:path";

import { PrismaClient } from "@prisma/client";

const LANE_GBP = { tier_25: 2187, tier_30: 2041, tier_35: 1895, tier_40: 1750 };
function laneCostForTier(tier) {
  return LANE_GBP[tier] ?? LANE_GBP.tier_30;
}

function contactsFromLegacy(row) {
  if (Array.isArray(row.contacts) && row.contacts.length > 0) {
    return row.contacts
      .filter((c) => c?.name?.trim() || c?.email?.trim())
      .map((c) => ({
        name: String(c.name || "").trim() || "Contact",
        email: c.email ? String(c.email).trim() : null,
      }));
  }
  const name = row.contactPerson?.trim();
  const email = row.email?.trim() || null;
  if (!name && !email) return [];
  return [{ name: name || "Contact", email }];
}



const prisma = new PrismaClient();

const inFile = process.argv.find((a) => !a.startsWith("-"))?.endsWith(".json")

  ? process.argv.find((a) => a.endsWith(".json"))

  : path.join(process.cwd(), "data", "ops-clients.export.json");



async function main() {

  if (!process.argv.includes("--confirm")) {

    console.error("Refusing without --confirm");

    console.error(`Example: node scripts/restore-ops-clients.mjs ${inFile} --confirm`);

    process.exit(1);

  }



  if (!fs.existsSync(inFile)) {

    console.error(`File not found: ${inFile}`);

    process.exit(1);

  }



  const raw = JSON.parse(fs.readFileSync(inFile, "utf-8"));

  const rows = Array.isArray(raw?.clients) ? raw.clients : [];

  if (rows.length === 0) {

    console.error("No clients in file");

    process.exit(1);

  }



  const existing = await prisma.opsClient.count();

  if (existing > 0) {

    console.error(`Database already has ${existing} client(s). Delete them first or merge manually.`);

    process.exit(1);

  }



  let created = 0;

  for (const row of rows) {

    const name = String(row.name || "").trim();

    if (!name) continue;



    const tier = row.commercial?.pricingTier || "tier_30";

    const laneCost =

      row.commercial?.laneCostGbp != null

        ? Number(row.commercial.laneCostGbp)

        : laneCostForTier(tier);

    const contacts = contactsFromLegacy(row);



    await prisma.opsClient.create({

      data: {

        name,

        companyName: row.companyName ?? null,

        software: row.software ?? null,

        phone: row.phone ?? null,

        country: row.country ?? null,

        status: row.status === "inactive" ? "inactive" : "active",

        notes: row.notes ?? null,

        contacts: {

          create: contacts.map((c, i) => ({

            name: c.name,

            email: c.email,

            sortOrder: i,

          })),

        },

        commercial: {

          create: {

            pricingTier: tier,

            laneCostGbp: laneCost,

            overtimeBillingGbp: row.commercial?.overtimeBillingGbp ?? 20,

            activeLaneCount: row.commercial?.activeLaneCount ?? 1,

            notes: row.commercial?.notes ?? null,

          },

        },

      },

    });

    created++;

    console.log(`  + ${name}`);

  }



  console.log(`\nRestored ${created} client(s).`);

}



main()

  .catch((e) => {

    console.error(e);

    process.exit(1);

  })

  .finally(() => prisma.$disconnect());


