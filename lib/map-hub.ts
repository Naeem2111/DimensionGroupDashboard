/**
 * Icon Architects studio — 5 Plato Place, 72–74 St Dionis Road, London SW6 4TU.
 * Used when the hub row has no latitude/longitude in the DB yet (see Nominatim: Plato Place SW6).
 */
export const ICON_ARCHITECTS_STUDIO = { lat: 51.4734803, lng: -0.203613 };

export type MapHubAnchor = {
  slug: string;
  name: string;
  /** Hub map pin — Plato Place for Icon Architects; otherwise DB coords or London fallback. */
  lat: number;
  lng: number;
};

function slugFromUrl(url: string): string {
  const m = url.match(/\/practice\/([^/]+)\/?$/);
  return m ? m[1] : "";
}

/** Matches the first-client hub practice name (case-insensitive, anywhere in the string). */
const DEFAULT_HUB_NAME = /\bicon\s+architects\b/i;

export type MapAnchorRow = {
  name: string;
  url: string;
  latitude: number | null;
  longitude: number | null;
};

/** True when the anchor is pinned at the Icon Architects studio (Plato Place). */
export function hubUsesIconStudio(anchor: MapHubAnchor): boolean {
  return (
    Math.abs(anchor.lat - ICON_ARCHITECTS_STUDIO.lat) < 0.0003 &&
    Math.abs(anchor.lng - ICON_ARCHITECTS_STUDIO.lng) < 0.0003
  );
}

export function resolveMapHub(rows: MapAnchorRow[]): MapHubAnchor | null {
  const envSlug = process.env.MAP_HUB_SLUG?.trim();
  const envName = process.env.MAP_HUB_NAME?.trim();

  if (envSlug) {
    for (const r of rows) {
      if (slugFromUrl(r.url) === envSlug) return toAnchor(r);
    }
  }

  if (envName) {
    const lower = envName.toLowerCase();
    for (const r of rows) {
      if (r.name.trim().toLowerCase() === lower) return toAnchor(r);
    }
  }

  for (const r of rows) {
    if (DEFAULT_HUB_NAME.test(r.name.trim())) return toAnchor(r);
  }

  return null;
}

/** Map always centres on Icon Architects (Plato Place) when no hub row is resolved from data/env. */
export const SYNTHETIC_ICON_FOCAL_ANCHOR: MapHubAnchor = {
  slug: "",
  name: "Icon Architects",
  ...ICON_ARCHITECTS_STUDIO,
};

export function getMapFocalAnchor(rows: MapAnchorRow[]): MapHubAnchor {
  return resolveMapHub(rows) ?? SYNTHETIC_ICON_FOCAL_ANCHOR;
}

/** Non–Icon hub rows with no DB coords — central London (not the Icon studio). */
const GENERIC_LONDON_FALLBACK = { lat: 51.5074, lng: -0.1278 };

function usesIconStudioCoordinates(r: MapAnchorRow): boolean {
  if (DEFAULT_HUB_NAME.test(r.name.trim())) return true;
  return r.url.toLowerCase().includes("icon-architects.com");
}

function toAnchor(r: MapAnchorRow): MapHubAnchor {
  const slug = slugFromUrl(r.url);
  if (usesIconStudioCoordinates(r)) {
    return { slug, name: r.name, ...ICON_ARCHITECTS_STUDIO };
  }
  if (r.latitude != null && r.longitude != null) {
    return { slug, name: r.name, lat: r.latitude, lng: r.longitude };
  }
  return { slug, name: r.name, ...GENERIC_LONDON_FALLBACK };
}
