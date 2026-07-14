/**
 * Export ops clients (+ commercial profiles, contacts) to JSON.
 * Usage: node scripts/export-ops-clients.mjs [out-file]
 * Optional: RESTORE_DATABASE_URL for a Neon PITR branch instead of DATABASE_URL.
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const url = process.env.RESTORE_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL or RESTORE_DATABASE_URL");
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });
const outFile = process.argv[2] || path.join(process.cwd(), "data", "ops-clients.export.json");

async function main() {
  const clients = await prisma.opsClient.findMany({
    orderBy: { name: "asc" },
    include: {
      commercial: true,
      contacts: { orderBy: { sortOrder: "asc" } },
    },
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    clients: clients.map((c) => ({
      name: c.name,
      companyName: c.companyName,
      software: c.software,
      contacts: c.contacts.map((ct) => ({ name: ct.name, email: ct.email })),
      phone: c.phone,
      country: c.country,
      status: c.status,
      notes: c.notes,
      commercial: c.commercial
        ? {
            pricingTier: c.commercial.pricingTier,
            laneCostGbp: Number(c.commercial.laneCostGbp),
            overtimeBillingGbp: Number(c.commercial.overtimeBillingGbp),
            activeLaneCount: c.commercial.activeLaneCount,
            notes: c.commercial.notes,
          }
        : null,
    })),
  };

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${clients.length} client(s) to ${outFile}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
