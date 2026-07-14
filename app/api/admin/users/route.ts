import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth";
import { createUser, listUsersPublic, type UserRole } from "@/lib/users-store";

export async function GET(request: NextRequest) {
  const gate = await requireAdminRequest(request);
  if (gate instanceof NextResponse) return gate;
  return NextResponse.json({ users: await listUsersPublic() });
}

export async function POST(request: NextRequest) {
  const gate = await requireAdminRequest(request);
  if (gate instanceof NextResponse) return gate;
  try {
    const body = await request.json();
    const username = String(body.username || "");
    const password = String(body.password || "");
    const role =
      body.role === "admin" || body.role === "manager" || body.role === "user"
        ? (body.role as UserRole)
        : "user";
    const disabled = Boolean(body.disabled);
    const created = await createUser({ username, password, role, disabled });
    if (!created.ok) {
      return NextResponse.json({ error: created.error }, { status: 400 });
    }
    return NextResponse.json({ user: created.user }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
