import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type SessionRole = "admin" | "manager" | "user";

type SessionPayload = {
  sub: string;
  role: SessionRole;
  exp: number;
};

const AUTH_COOKIE = "dg_session";

function sessionSecret(): string {
  const s =
    process.env.DG_SESSION_SECRET?.trim() || process.env.BLOCHARCH_SESSION_SECRET?.trim();
  if (s && s.length >= 16) return s;
  return "__dimension_group_dev_session_secret__";
}

function utf8Bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
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

async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  const secret = sessionSecret();
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const bodyBytes = base64UrlToBytes(token.slice(0, dot));
  const sigBytes = base64UrlToBytes(token.slice(dot + 1));
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
  if (exp <= Math.floor(Date.now() / 1000)) return null;
  return { sub, role, exp };
}

function defaultDashboardPath(role: SessionRole): string {
  if (role === "admin" || role === "manager") return "/dashboard";
  return "/login?error=forbidden";
}

function isMarketingDashboardPath(path: string): boolean {
  return (
    path === "/dashboard" ||
    path.startsWith("/dashboard/practices") ||
    path.startsWith("/dashboard/map") ||
    path.startsWith("/dashboard/automation") ||
    path.startsWith("/dashboard/marketing")
  );
}

function isMarketingApiPath(path: string): boolean {
  return (
    path.startsWith("/api/practices") ||
    path === "/api/stats" ||
    path.startsWith("/api/leads") ||
    path.startsWith("/api/marketing") ||
    path.startsWith("/api/workflow") ||
    path === "/api/templates" ||
    path.startsWith("/api/geocode")
  );
}

function isAdminDashboardPath(path: string): boolean {
  return path.startsWith("/dashboard/admin");
}

function isAdminApiPath(path: string): boolean {
  return path.startsWith("/api/admin/");
}

function canAccessMarketing(role: SessionRole): boolean {
  return role === "admin" || role === "manager";
}

function canAccessAdmin(role: SessionRole): boolean {
  return role === "admin";
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (path === "/api/public/enquiry") {
    return NextResponse.next();
  }

  const isApi = path.startsWith("/api/");
  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  const payload = cookie ? await verifySessionToken(cookie) : null;
  const isAuthenticated = payload !== null;
  const role = payload?.role ?? null;

  if (path === "/login") {
    return NextResponse.next();
  }

  const isN8nPath = path.startsWith("/api/n8n/");
  const apiKey = request.headers.get("x-api-key") || request.nextUrl.searchParams.get("apiKey");
  const n8nAuthorized =
    isN8nPath &&
    process.env.N8N_API_KEY &&
    apiKey &&
    apiKey === process.env.N8N_API_KEY;

  if ((isAdminDashboardPath(path) || isAdminApiPath(path)) && !n8nAuthorized) {
    if (!role || !canAccessAdmin(role)) {
      if (isApi) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL(defaultDashboardPath(role ?? "user"), request.url));
    }
  }

  if ((isMarketingDashboardPath(path) || isMarketingApiPath(path)) && !n8nAuthorized) {
    if (!role || !canAccessMarketing(role)) {
      if (isApi) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL(defaultDashboardPath(role ?? "user"), request.url));
    }
  }

  const isProtected = path.startsWith("/dashboard") || path.startsWith("/api/") || path === "/";
  if (isProtected && !isAuthenticated && !n8nAuthorized) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const login = new URL("/login", request.url);
    if (path !== "/") login.searchParams.set("from", path);
    return NextResponse.redirect(login);
  }

  if (path === "/") {
    return NextResponse.redirect(new URL(defaultDashboardPath(role ?? "user"), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/dashboard/:path*",
    "/api/practices/:path*",
    "/api/stats",
    "/api/leads/:path*",
    "/api/workflow/:path*",
    "/api/templates",
    "/api/n8n/:path*",
    "/api/geocode/:path*",
    "/api/me",
    "/api/me/preferences",
    "/api/admin/:path*",
    "/api/marketing/:path*",
    "/api/public/enquiry",
  ],
};
