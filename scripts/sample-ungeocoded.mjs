import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

function getBestAddressFromFields(address, description) {
  const direct = String(address || "").trim();
  if (direct) return direct;
  const desc = String(description || "").trim();
  if (!desc) return null;
  const m = desc.match(
    /\bAddresses?\b\s+([\s\S]*?)(?=\bContact\b|\bEmail\b|\bWebsite\b|\bTwitter\b|\bInstagram\b|\bLinkedIn\b|\bFacebook\b|\bBack to Results\b|$)/i
  );
  if (!m?.[1]) return null;
  return m[1].replace(/\s+/g, " ").trim().slice(0, 160) || null;
}

const rows = await p.architect.findMany({
  where: { OR: [{ latitude: null }, { longitude: null }] },
  select: { name: true, address: true, description: true },
  take: 15,
});

let noExtract = 0;
let hasField = 0;
let hasExtract = 0;
const all = await p.architect.findMany({
  where: { OR: [{ latitude: null }, { longitude: null }] },
  select: { address: true, description: true },
});

for (const r of all) {
  const direct = String(r.address || "").trim();
  const extracted = getBestAddressFromFields(r.address, r.description);
  if (direct) hasField++;
  else if (extracted) hasExtract++;
  else noExtract++;
}

console.log("ungeocoded breakdown:", { total: all.length, hasAddressField: hasField, extractedFromDesc: hasExtract, noUsableAddress: noExtract });

for (const r of rows.slice(0, 5)) {
  const best = getBestAddressFromFields(r.address, r.description);
  console.log("\n---", r.name);
  console.log("field:", (r.address || "").slice(0, 100));
  console.log("best:", best?.slice(0, 100) || "(none)");
  console.log("desc head:", (r.description || "").slice(0, 150));
}

await p.$disconnect();
