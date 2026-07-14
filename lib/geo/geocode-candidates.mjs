/**
 * UK postcode + geocode query builders (Node + Next.js).
 * Full street addresses often fail Nominatim; postcode / town+postcode usually works.
 */

/** @typedef {{ lat: number; lng: number; displayName?: string; matchedQuery: string }} GeocodeHit */

const UK_POSTCODE =
  /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/gi;

export function normalizeSpaces(s) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ");
}

/** @returns {string[]} */
export function extractUkPostcodes(text) {
  const seen = new Set();
  const out = [];
  const raw = String(text || "");
  UK_POSTCODE.lastIndex = 0;
  let m;
  while ((m = UK_POSTCODE.exec(raw)) !== null) {
    const pc = m[1].toUpperCase().replace(/\s+/, " ");
    if (!seen.has(pc)) {
      seen.add(pc);
      out.push(pc);
    }
  }
  return out;
}

/** Last postcode in the string — usually the practice's primary UK postcode. */
export function primaryUkPostcode(text) {
  const raw = String(text || "");
  UK_POSTCODE.lastIndex = 0;
  let last = null;
  let m;
  while ((m = UK_POSTCODE.exec(raw)) !== null) {
    last = m[1].toUpperCase().replace(/\s+/g, " ").trim();
  }
  return last;
}

/** Canonical form for deduping/API lookup (e.g. "SE10JF"). */
export function compactUkPostcode(postcode) {
  return String(postcode || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim();
}

/** Display form with a single space before the inward code (e.g. "SE1 0JF"). */
export function formatUkPostcode(postcode) {
  const c = compactUkPostcode(postcode);
  if (c.length < 5) return c;
  return `${c.slice(0, -3)} ${c.slice(-3)}`;
}

/** Last comma-separated locality before a postcode (e.g. "London" from "… Dock, London, SE1 0JF"). */
export function townBeforePostcode(address, postcode) {
  const u = address.toUpperCase();
  const p = postcode.toUpperCase();
  const idx = u.indexOf(p);
  if (idx <= 0) return null;
  const before = address.slice(0, idx).replace(/[,\s]+$/, "");
  const parts = before
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
}

/**
 * Ordered unique Nominatim queries — most specific first, then postcode approximations.
 * @param {string} address
 * @param {string} [practiceName]
 * @returns {string[]}
 */
export function buildGeocodeQueries(address, practiceName) {
  const cleaned = normalizeSpaces(address);
  if (!cleaned) return [];

  const seen = new Set();
  /** @param {string} q */
  const add = (q) => {
    const t = normalizeSpaces(q);
    if (!t || t.length < 3) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    queries.push(t);
  };

  const queries = [];
  const postcodes = extractUkPostcodes(cleaned);
  const name = normalizeSpaces(practiceName || "");

  add(`${cleaned}, United Kingdom`);
  add(cleaned);

  for (const pc of postcodes) {
    const town = townBeforePostcode(cleaned, pc);
    if (town) add(`${town}, ${pc}, United Kingdom`);
    add(`${pc}, United Kingdom`);
    add(pc);
  }

  if (name && postcodes[0]) {
    add(`${name}, ${postcodes[0]}, United Kingdom`);
  }

  if (postcodes.length > 1) {
    for (let i = 1; i < postcodes.length; i++) {
      const pc = postcodes[i];
      const town = townBeforePostcode(cleaned, pc);
      if (town) add(`${town}, ${pc}, United Kingdom`);
      add(`${pc}, United Kingdom`);
    }
  }

  return queries;
}

export function getBestAddressFromFields(address, description) {
  const direct = normalizeSpaces(address);
  if (direct) return direct;

  const desc = String(description || "").trim();
  if (!desc) return null;

  const m = desc.match(
    /\bAddresses?\b\s+([\s\S]*?)(?=\bContact\b|\bEmail\b|\bWebsite\b|\bTwitter\b|\bInstagram\b|\bLinkedIn\b|\bFacebook\b|\bBack to Results\b|$)/i
  );
  if (!m?.[1]) return null;
  const extracted = normalizeSpaces(m[1]);
  if (!extracted) return null;
  return extracted.length > 200 ? extracted.slice(0, 200) : extracted;
}
