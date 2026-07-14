import { PrismaClient } from "@prisma/client";
import { getBestAddressFromFields } from "../lib/geo/geocode-candidates.mjs";

const p = new PrismaClient();

const total = await p.architect.count();
const geocoded = await p.architect.count({
  where: { latitude: { not: null }, longitude: { not: null } },
});

const rows = await p.architect.findMany({
  select: { address: true, description: true, latitude: true, longitude: true },
});

let withAddress = 0;
let mappable = 0;
for (const r of rows) {
  const addr = getBestAddressFromFields(r.address, r.description);
  if (addr) {
    withAddress++;
    if (r.latitude != null && r.longitude != null) mappable++;
  }
}

console.log(JSON.stringify({ total, geocoded, withAddress, mappable, pending: withAddress - mappable }, null, 2));
await p.$disconnect();
