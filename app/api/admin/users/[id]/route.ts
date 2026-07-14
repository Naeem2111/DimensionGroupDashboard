import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth";
import { deleteUser, updateUser, type UserRole } from "@/lib/users-store";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Ctx) {
  const gate = await requireAdminRequest(request);
  if (gate instanceof NextResponse) return gate;
  const { id } = await context.params;
  try {
    const body = await request.json();
    const patch: { password?: string; role?: UserRole; disabled?: boolean } = {};
    if (typeof body.password === "string" && body.password.length > 0) {
      patch.password = body.password;
    }
    if (body.role === "admin" || body.role === "manager" || body.role === "user") {
      patch.role = body.role;
    }
    if (typeof body.disabled === "boolean") {
      patch.disabled = body.disabled;
    }
    const updated = await updateUser(id, patch, gate.user.id);
    if (!updated.ok) {
      return NextResponse.json({ error: updated.error }, { status: 400 });
    }
    return NextResponse.json({ user: updated.user });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, context: Ctx) {
  const gate = await requireAdminRequest(request);
  if (gate instanceof NextResponse) return gate;
  const { id } = await context.params;
  const removed = await deleteUser(id, gate.user.id);
  if (!removed.ok) {
    return NextResponse.json({ error: removed.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
