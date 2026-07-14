import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";
import { requestIsSecure } from "@/lib/request-https";

export async function POST(request: NextRequest) {
  const secure = requestIsSecure(request);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return res;
}
