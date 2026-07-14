import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;
const SALT_LEN = 16;
const KEY_LEN = 32;

/** Format: scrypt$<salt_b64>$<hash_b64> */
export function hashPassword(plain: string): string {
  const salt = randomBytes(SALT_LEN);
  const hash = scryptSync(plain, salt, KEY_LEN, SCRYPT_PARAMS);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  if (!stored || !stored.startsWith("scrypt$")) return false;
  const parts = stored.split("$");
  if (parts.length !== 3) return false;
  const [, saltB64, hashB64] = parts;
  try {
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    const actual = scryptSync(plain, salt, expected.length, SCRYPT_PARAMS);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
