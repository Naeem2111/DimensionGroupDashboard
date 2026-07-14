import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { updateUserPreferences } from "@/lib/users-store";
import { THEME_COOKIE, isThemePreference, themeCookieMaxAge } from "@/lib/theme";
import { requestIsSecure } from "@/lib/request-https";

export async function PATCH(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const theme = (body as { theme?: unknown }).theme;
  if (!isThemePreference(theme)) {
    return NextResponse.json({ error: 'Theme must be "dark" or "light"' }, { status: 400 });
  }

  const updated = await updateUserPreferences(session.user.id, { theme });
  if (!updated.ok) {
    return NextResponse.json({ error: updated.error }, { status: 400 });
  }

  const res = NextResponse.json({ theme: updated.user.theme });
  res.cookies.set(THEME_COOKIE, updated.user.theme, {
    httpOnly: false,
    secure: requestIsSecure(request),
    sameSite: "lax",
    maxAge: themeCookieMaxAge(),
    path: "/",
  });
  return res;
}
