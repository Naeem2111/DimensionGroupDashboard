/**
 * Migrate legacy ops_clients.contact_person + email into ops_client_contacts,
 * add software column, then run: npx prisma db push --accept-data-loss
 *
 * Usage: node scripts/migrate-ops-client-contacts.mjs --confirm
 */
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();

async function columnExists(table, column) {
  const rows = await prisma.$queryRaw`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table} AND column_name = ${column}
    LIMIT 1
  `;
  return rows.length > 0;
}

async function tableExists(table) {
  const rows = await prisma.$queryRaw`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ${table}
    LIMIT 1
  `;
  return rows.length > 0;
}

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.error("Refusing without --confirm");
    process.exit(1);
  }

  if (!(await tableExists("ops_client_contacts"))) {
    await prisma.$executeRaw`
      CREATE TABLE ops_client_contacts (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL REFERENCES ops_clients(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        email TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await prisma.$executeRaw`
      CREATE INDEX ops_client_contacts_client_id_idx ON ops_client_contacts(client_id)
    `;
    console.log("Created ops_client_contacts table.");
  }

  if (!(await columnExists("ops_clients", "software"))) {
    await prisma.$executeRaw`ALTER TABLE ops_clients ADD COLUMN software TEXT`;
    console.log("Added software column.");
  }

  const hasLegacy = await columnExists("ops_clients", "contact_person");
  if (!hasLegacy) {
    console.log("Legacy columns already removed.");
    return;
  }

  const rows = await prisma.$queryRaw`
    SELECT id, contact_person, email FROM ops_clients
    WHERE contact_person IS NOT NULL OR email IS NOT NULL
  `;

  let migrated = 0;
  for (const row of rows) {
    const existing = await prisma.$queryRaw`
      SELECT 1 FROM ops_client_contacts WHERE client_id = ${row.id} LIMIT 1
    `;
    if (existing.length > 0) continue;

    const name = row.contact_person?.trim() || "Contact";
    const email = row.email?.trim() || null;
    await prisma.$executeRaw`
      INSERT INTO ops_client_contacts (id, client_id, name, email, sort_order)
      VALUES (${randomUUID()}, ${row.id}, ${name}, ${email}, 0)
    `;
    migrated++;
  }

  console.log(`Migrated ${migrated} contact row(s).`);
  console.log("Next: npx prisma db push --accept-data-loss");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
