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
      if (isN8n) {
        const expected = process.env.N8N_API_KEY?.trim() || "";
        const apiKey = (
          request.headers.get("x-api-key") ||
          request.nextUrl.searchParams.get("apiKey") ||
          ""
        ).trim();

        if (!expected) {
          return NextResponse.json(
            {
              error: "Unauthorized",
              detail:
                "N8N_API_KEY is not set on the server. Add it in Vercel → Settings → Environment Variables (Production) and redeploy.",
            },
            { status: 401 }
          );
        }

        if (!apiKey || apiKey !== expected) {
          return NextResponse.json(
            {
              error: "Unauthorized",
              detail:
                "X-Api-Key does not match N8N_API_KEY. Use the same shared secret on Vercel and in the n8n header (not an n8n Settings JWT).",
            },
            { status: 401 }
          );
        }

        return NextResponse.next();
      }

      if (!hasSessionCookie(request)) {
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
