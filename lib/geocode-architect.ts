import { getBestAddressFromFields } from "@/lib/address-display";
import { geocodeWithFallback } from "@/lib/geo/nominatim";
import { getCachedGeocode } from "@/lib/geo/store";
import { prisma } from "@/lib/prisma";

/** Geocode a practice address and persist coordinates on the Architect row. */
export async function geocodeAndPersistArchitect(
  architectId: string,
  address: string,
  practiceName?: string
): Promise<{ lat: number; lng: number } | null> {
  const trimmed = address.trim();
  if (!trimmed) {
    await prisma.architect.update({
      where: { id: architectId },
      data: { latitude: null, longitude: null, geocodedAt: null },
    });
    return null;
  }

  const cached = getCachedGeocode(trimmed);
  const point =
    cached ??
    (await geocodeWithFallback(trimmed, {
      practiceName,
      sleepMs: 1100,
    }));

  if (!point) return null;

  await prisma.architect.update({
    where: { id: architectId },
    data: {
      latitude: point.lat,
      longitude: point.lng,
      geocodedAt: new Date(),
    },
  });

  return { lat: point.lat, lng: point.lng };
}

/** Resolve best address string from architect fields, then geocode if present. */
export async function geocodeArchitectFromFields(
  architectId: string,
  fields: { name: string; address?: string | null; description?: string | null }
): Promise<{ lat: number; lng: number } | null> {
  const address = getBestAddressFromFields(fields.address ?? "", fields.description ?? "");
  if (!address) {
    await prisma.architect.update({
      where: { id: architectId },
      data: { latitude: null, longitude: null, geocodedAt: null },
    });
    return null;
  }
  return geocodeAndPersistArchitect(architectId, address, fields.name);
}
