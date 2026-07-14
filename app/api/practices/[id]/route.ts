import { NextRequest } from "next/server";
import { findArchitectBySlugOrUrl, loadArchitects, updateArchitect } from "@/lib/architects";
import { slugFromPracticeUrl } from "@/lib/practice-url";

function slugFromUrl(url: string): string {
  return slugFromPracticeUrl(url);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const practice = await findArchitectBySlugOrUrl(id);
  if (practice) {
    return Response.json(practice);
  }

  const architects = await loadArchitects();
  const idx = parseInt(id, 10);
  if (!isNaN(idx) && idx >= 0 && idx < architects.length) {
    return Response.json(architects[idx]);
  }
  return Response.json({ error: "Not found" }, { status: 404 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const updates: {
    name?: string;
    email?: string | null;
    contact?: string | null;
    phone?: string | null;
    website?: string | null;
    address?: string | null;
  } = {};

  if (typeof body.name === "string") updates.name = body.name;
  if (body.email === null || typeof body.email === "string") updates.email = body.email;
  if (body.contact === null || typeof body.contact === "string") updates.contact = body.contact;
  if (body.phone === null || typeof body.phone === "string") updates.phone = body.phone;
  if (body.website === null || typeof body.website === "string") updates.website = body.website;
  if (body.address === null || typeof body.address === "string") updates.address = body.address;

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No updates provided" }, { status: 400 });
  }

  try {
    const practice = await updateArchitect(id, updates);
    return Response.json(practice);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update practice";
    const status = message === "Practice not found" ? 404 : 400;
    return Response.json({ error: message }, { status });
  }
}
