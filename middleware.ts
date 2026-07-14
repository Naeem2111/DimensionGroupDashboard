import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken, type SessionRole } from "@/lib/session-token";
import {
  canAccessModule,
  canAccessOpsApiPath,
  canAccessOpsDashboardPath,
  defaultDashboardPath,
  isAdminApiPath,
  isAdminDashboardPath,
  isAthleteApiPath,
  isAthleteDashboardPath,
  isMarketingApiPath,
  isMarketingDashboardPath,
  isOpsApiPath,
  isOpsDashboardPath,
} from "@/lib/permissions";

const AUTH_COOKIE = "dg_session";

function roleFromPayload(payload: { role: SessionRole } | null): SessionRole | null {
  return payload?.role ?? null;
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
  const role = roleFromPayload(payload);

  // /login: never redirect authenticated users here — RSC flight requests break on 302.
  // Server `app/login/page.tsx` calls redirect() when a session exists instead.
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
    if (!role || !canAccessModule(role, "admin")) {
      if (isApi) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL(defaultDashboardPath(role ?? "user"), request.url));
    }
  }

  if ((isMarketingDashboardPath(path) || isMarketingApiPath(path)) && !n8nAuthorized) {
    if (!role || !canAccessModule(role, "marketing")) {
      if (isApi) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL(defaultDashboardPath(role ?? "user"), request.url));
    }
  }

  if ((isOpsDashboardPath(path) || isOpsApiPath(path)) && !n8nAuthorized) {
    const allowed = isOpsApiPath(path)
      ? role != null && canAccessOpsApiPath(role, path)
      : role != null && canAccessOpsDashboardPath(role, path);
    if (!allowed) {
      if (isApi) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL(defaultDashboardPath(role ?? "user"), request.url));
    }
  }

  if ((isAthleteDashboardPath(path) || isAthleteApiPath(path)) && !n8nAuthorized) {
    if (!role || !canAccessModule(role, "athlete_portal")) {
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
    "/api/planner/:path*",
    "/api/ops/:path*",
    "/api/athlete/:path*",
    "/api/public/enquiry",
  ],
};
