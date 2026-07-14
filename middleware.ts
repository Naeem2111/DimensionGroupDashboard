import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "dg_session";

function hasSessionCookie(request: NextRequest): boolean {
  const value = request.cookies.get(AUTH_COOKIE)?.value;
  return typeof value === "string" && value.includes(".");
}

export function middleware(request: NextRequest) {
  try {
    const path = request.nextUrl.pathname;

    if (path.startsWith("/dashboard") && !hasSessionCookie(request)) {
      const login = new URL("/login", request.url);
      login.searchParams.set("from", path);
      return NextResponse.redirect(login);
    }

    if (
      path.startsWith("/api/") &&
      !path.startsWith("/api/public/") &&
      !path.startsWith("/api/auth/")
    ) {
      const isN8n = path.startsWith("/api/n8n/");
      const apiKey =
        request.headers.get("x-api-key") || request.nextUrl.searchParams.get("apiKey");
      const n8nOk =
        isN8n &&
        Boolean(process.env.N8N_API_KEY) &&
        Boolean(apiKey) &&
        apiKey === process.env.N8N_API_KEY;

      if (!n8nOk && !hasSessionCookie(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    return NextResponse.next();
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};
