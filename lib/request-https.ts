import type { NextRequest } from "next/server";

/** True when the incoming request is HTTPS (or behind a TLS terminator that sets x-forwarded-proto). */
export function requestIsSecure(request: NextRequest): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim().toLowerCase();
    if (first === "https" || first === "http") {
      return first === "https";
    }
  }
  return request.nextUrl.protocol === "https:";
}
