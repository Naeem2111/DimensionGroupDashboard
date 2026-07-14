import {
  buildGeocodeQueries,
  getBestAddressFromFields,
  normalizeSpaces,
} from "@/lib/geo/uk-address";
import { getCachedGeocode, setCachedGeocode, type GeoPoint, normalizeAddress } from "@/lib/geo/store";

function getUserAgent(): string {
  return (
    process.env.GEOCODER_USER_AGENT ||
    "blocarch-dashboard (Next.js) - contact: set GEOCODER_USER_AGENT"
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function nominatimSearch(
  query: string,
  options?: { countrycodes?: string }
): Promise<GeoPoint | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", query);
  if (options?.countrycodes) {
    url.searchParams.set("countrycodes", options.countrycodes);
  }

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": getUserAgent(),
      "Accept-Language": "en",
    },
    cache: "no-store",
  });

  if (!res.ok) return null;
  const json = (await res.json()) as Array<{ lat: string; lon: string; display_name?: string }>;
  const first = json?.[0];
  if (!first?.lat || !first?.lon) return null;

  const point: GeoPoint = {
    lat: Number(first.lat),
    lng: Number(first.lon),
    displayName: first.display_name,
  };
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return null;
  return point;
}

/** Single-query geocode (legacy). */
export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  return geocodeWithFallback(address);
}

/**
 * Try full address then postcode / town fallbacks for approximate UK pins.
 * Respects Nominatim rate limit with ~1.1s between attempts.
 */
export async function geocodeWithFallback(
  address: string,
  context?: { practiceName?: string; sleepMs?: number }
): Promise<GeoPoint | null> {
  const cleaned = normalizeSpaces(address);
  if (!cleaned) return null;

  const cacheKey = normalizeAddress(cleaned);
  const cached = getCachedGeocode(cacheKey);
  if (cached) return cached;

  const pause = context?.sleepMs ?? 1100;
  const queries = buildGeocodeQueries(cleaned, context?.practiceName);

  for (const q of queries) {
    let point = await nominatimSearch(q, { countrycodes: "gb" });
    if (!point) {
      await sleep(pause);
      point = await nominatimSearch(q);
    }
    if (point) {
      setCachedGeocode(cacheKey, point);
      return point;
    }
    await sleep(pause);
  }

  return null;
}

export { getBestAddressFromFields };
