import { NextRequest } from "next/server";
import { createManualPractice, searchArchitects } from "@/lib/architects";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || undefined;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const perPage = parseInt(searchParams.get("perPage") || "25", 10);

  const result = await searchArchitects({ q, page, perPage });
  return Response.json(result);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  if (typeof body.name !== "string" || typeof body.email !== "string") {
    return Response.json({ error: "Name and email are required" }, { status: 400 });
  }

  try {
    const practice = await createManualPractice({
      name: body.name,
      email: body.email,
      contact: typeof body.contact === "string" ? body.contact : undefined,
      phone: typeof body.phone === "string" ? body.phone : undefined,
      website: typeof body.website === "string" ? body.website : undefined,
      address: typeof body.address === "string" ? body.address : undefined,
    });
    return Response.json(practice, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create practice";
    return Response.json({ error: message }, { status: 400 });
  }
}
