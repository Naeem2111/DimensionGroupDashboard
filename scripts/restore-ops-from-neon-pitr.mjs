/**
 * Pull clients from a Neon point-in-time branch into the live database.
 *
 * 1. In Neon Console: Branches → Create branch → "Point in time"
 *    Pick a time BEFORE the wipe (when clients still existed).
 * 2. Copy that branch's connection string into RESTORE_DATABASE_URL (in .env or shell).
 * 3. Run:
 *      node scripts/restore-ops-from-neon-pitr.mjs --confirm
 */
import { PrismaClient } from "@prisma/client";

const restoreUrl = process.env.RESTORE_DATABASE_URL;
const liveUrl = process.env.DATABASE_URL;

if (!restoreUrl || !liveUrl) {
  console.error("Set both RESTORE_DATABASE_URL (PITR branch) and DATABASE_URL (live).");
  process.exit(1);
}

const restoreDb = new PrismaClient({ datasources: { db: { url: restoreUrl } } });
const liveDb = new PrismaClient({ datasources: { db: { url: liveUrl } } });

const LANE_GBP = { tier_25: 2187, tier_30: 2041, tier_35: 1895, tier_40: 1750 };
function laneCostForTier(tier) {
  return LANE_GBP[tier] ?? LANE_GBP.tier_30;
}

function contactsFromLegacy(c) {
  if (c.contacts?.length) {
    return c.contacts.map((ct) => ({
      name: ct.name?.trim() || "Contact",
      email: ct.email?.trim() || null,
    }));
  }
  const name = c.contactPerson?.trim?.() ?? c.contactPerson ?? null;
  const email = c.email?.trim?.() ?? c.email ?? null;
  if (!name && !email) return [];
  return [{ name: name || "Contact", email: email || null }];
}

async function loadRestoreClients() {
  try {
    return await restoreDb.opsClient.findMany({
      orderBy: { name: "asc" },
      include: {
        commercial: true,
        contacts: { orderBy: { sortOrder: "asc" } },
      },
    });
  } catch {
    const clients = await restoreDb.opsClient.findMany({
      orderBy: { name: "asc" },
      include: { commercial: true },
    });
    let legacy = [];
    try {
      legacy = await restoreDb.$queryRaw`
        SELECT id, contact_person, email FROM ops_clients
      `;
    } catch {
      /* column already dropped on branch */
    }
    const byId = new Map(legacy.map((r) => [r.id, r]));
    return clients.map((c) => ({
      ...c,
      contacts: [],
      contactPerson: byId.get(c.id)?.contact_person ?? null,
      email: byId.get(c.id)?.email ?? null,
    }));
  }
}

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.error("Refusing without --confirm");
    process.exit(1);
  }

  const [source, existing] = await Promise.all([loadRestoreClients(), liveDb.opsClient.count()]);

  if (source.length === 0) {
    console.error("No clients on RESTORE_DATABASE_URL — check branch timestamp.");
    process.exit(1);
  }

  if (existing > 0) {
    console.error(`Live DB already has ${existing} client(s). Clear or merge first.`);
    process.exit(1);
  }

  console.log(`Restoring ${source.length} client(s) from PITR branch…`);
  for (const c of source) {
    const tier = c.commercial?.pricingTier || "tier_30";
    const contacts = contactsFromLegacy(c);
    await liveDb.opsClient.create({
      data: {
        name: c.name,
        companyName: c.companyName,
        software: c.software ?? null,
        phone: c.phone,
        country: c.country,
        status: c.status,
        notes: c.notes,
        contacts: {
          create: contacts.map((ct, i) => ({
            name: ct.name,
            email: ct.email,
            sortOrder: i,
          })),
        },
        commercial: c.commercial
          ? {
              create: {
                pricingTier: tier,
                laneCostGbp: Number(c.commercial.laneCostGbp) || laneCostForTier(tier),
                overtimeBillingGbp: Number(c.commercial.overtimeBillingGbp),
                activeLaneCount: c.commercial.activeLaneCount,
                notes: c.commercial.notes,
              },
            }
          : {
              create: {
                pricingTier: "tier_30",
                laneCostGbp: laneCostForTier("tier_30"),
                activeLaneCount: 1,
              },
            },
      },
    });
    console.log(`  + ${c.name}`);
  }

  console.log("Done. Re-create athletes/projects separately if needed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await restoreDb.$disconnect();
    await liveDb.$disconnect();
  });
