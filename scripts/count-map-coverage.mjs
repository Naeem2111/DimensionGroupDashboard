import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function getBestAddressFromFields(address, description) {
  const direct = String(address || "").trim();
  if (direct) return direct;
  const desc = String(description || "").trim();
  if (!desc) return null;
  const m = desc.match(
    /\bAddresses?\b\s+([\s\S]*?)(?=\bContact\b|\bEmail\b|\bWebsite\b|\bTwitter\b|\bInstagram\b|\bLinkedIn\b|\bFacebook\b|\bBack to Results\b|$)/i
  );
  if (!m?.[1]) return null;
  const extracted = m[1].replace(/\s+/g, " ").trim();
  return extracted || null;
}

async function main() {
  const total = await prisma.architect.count();
  const geocoded = await prisma.architect.count({
    where: { latitude: { not: null }, longitude: { not: null } },
  });
  const missing = await prisma.architect.findMany({
    where: { OR: [{ latitude: null }, { longitude: null }] },
    select: { address: true, description: true },
  });
  let withAddress = 0;
  let withoutAddress = 0;
  for (const r of missing) {
    if (getBestAddressFromFields(r.address, r.description)) withAddress++;
    else withoutAddress++;
  }
  console.log({
    total,
    geocoded,
    missingCoords: missing.length,
    unmappedWithAddress: withAddress,
    unmappedNoAddress: withoutAddress,
  });
}

main().finally(() => prisma.$disconnect());
