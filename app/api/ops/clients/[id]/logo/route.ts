import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOpsSession } from "@/lib/ops-access";
import {
  CLIENT_LOGO_MAX_BYTES,
  isAllowedClientLogoMime,
  removeClientLogoFiles,
  saveClientLogoFile,
} from "@/lib/client-logo-storage";
import { clientInclude, mapClientToJson } from "@/lib/ops-client-api";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const { id } = await context.params;
  const existing = await prisma.opsClient.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("logo");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Logo file required" }, { status: 400 });
  }

  if (!isAllowedClientLogoMime(file.type)) {
    return NextResponse.json(
      { error: "Logo must be JPEG, PNG, WebP, or GIF" },
      { status: 400 }
    );
  }
  if (file.size > CLIENT_LOGO_MAX_BYTES) {
    return NextResponse.json({ error: "Logo must be 1 MB or smaller" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const logoPath = await saveClientLogoFile(id, file.type, bytes);
  const logoUrl = `${logoPath}?v=${Date.now()}`;

  const client = await prisma.opsClient.update({
    where: { id },
    data: { logoUrl },
    include: clientInclude,
  });

  return NextResponse.json({ client: mapClientToJson(client), logoUrl });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const { id } = await context.params;
  const existing = await prisma.opsClient.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  await removeClientLogoFiles(id);
  const client = await prisma.opsClient.update({
    where: { id },
    data: { logoUrl: null },
    include: clientInclude,
  });

  return NextResponse.json({ client: mapClientToJson(client) });
}
