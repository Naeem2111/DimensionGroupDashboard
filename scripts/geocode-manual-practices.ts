import { PrismaClient } from "@prisma/client";
import { geocodeArchitectFromFields } from "../lib/geocode-architect";

const prisma = new PrismaClient();

async function main() {
  const needles = ["initiate", "kost"];
  const practices = await prisma.architect.findMany({
    where: {
      OR: needles.map((n) => ({ name: { contains: n, mode: "insensitive" as const } })),
    },
    select: { id: true, name: true, address: true, description: true, latitude: true, longitude: true },
  });

  if (practices.length === 0) {
    console.log("No Initiate/KOST practices found in database.");
    return;
  }

  for (const p of practices) {
    console.log(`\n${p.name}`);
    console.log(`  before: lat=${p.latitude} lng=${p.longitude}`);
    const point = await geocodeArchitectFromFields(p.id, p);
    console.log(`  after:  ${point ? `lat=${point.lat} lng=${point.lng}` : "geocode failed"}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
