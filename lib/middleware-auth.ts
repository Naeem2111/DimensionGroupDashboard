/** Edge-safe auth helpers for middleware (no Node/DB imports). */
export type UserRole = "admin" | "manager" | "user";

export type SessionRole = UserRole;

export type SessionPayload = {
  sub: string;
  role: SessionRole;
  exp: number;
};

function sessionSecret(): string {
  const s =
    process.env.DG_SESSION_SECRET?.trim();
  if (s && s.length >= 16) return s;
  return "__dimension_group_dev_session_secret__";
}

function utf8Bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(s: string): Uint8Array | null {
  try {
    const pad = s.length % 4 === 0 ? "" : "====".slice(s.length % 4);
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  const hash = await crypto.subtle.digest("SHA-256", utf8Bytes(secret) as BufferSource);
  return crypto.subtle.importKey("raw", hash, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

async function signBytes(secret: string, data: Uint8Array): Promise<Uint8Array> {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, data as BufferSource);
  return new Uint8Array(sig);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  const secret = sessionSecret();
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const bodyB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);
  const bodyBytes = base64UrlToBytes(bodyB64);
  const sigBytes = base64UrlToBytes(sigB64);
  if (!bodyBytes || !sigBytes) return null;
  const expected = await signBytes(secret, bodyBytes);
  if (!timingSafeEqual(sigBytes, expected)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bodyBytes));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const sub = typeof o.sub === "string" ? o.sub : "";
  const role = o.role === "admin" || o.role === "user" || o.role === "manager" ? o.role : null;
  const exp = typeof o.exp === "number" ? o.exp : 0;
  if (!sub || !role || !exp) return null;
  const now = Math.floor(Date.now() / 1000);
  if (exp <= now) return null;
  return { sub, role, exp };
}

export function defaultDashboardPath(role: UserRole): string {
  if (role === "admin" || role === "manager") return "/dashboard";
  return "/login?error=forbidden";
}

export function isMarketingDashboardPath(path: string): boolean {
  if (path === "/dashboard") return true;
  if (path.startsWith("/dashboard/practices")) return true;
  if (path.startsWith("/dashboard/map")) return true;
  if (path.startsWith("/dashboard/automation")) return true;
  if (path.startsWith("/dashboard/marketing")) return true;
  return false;
}

export function isMarketingApiPath(path: string): boolean {
  if (path.startsWith("/api/practices")) return true;
  if (path === "/api/stats") return true;
  if (path.startsWith("/api/leads")) return true;
  if (path.startsWith("/api/marketing")) return true;
  if (path.startsWith("/api/workflow")) return true;
  if (path === "/api/templates") return true;
  if (path.startsWith("/api/geocode")) return true;
  return false;
}

export function isAdminDashboardPath(path: string): boolean {
  return path.startsWith("/dashboard/admin");
}

export function isAdminApiPath(path: string): boolean {
  return path.startsWith("/api/admin/");
}

export function canAccessMarketing(role: UserRole): boolean {
  return role === "admin" || role === "manager";
}

export function canAccessAdmin(role: UserRole): boolean {
  return role === "admin";
}
