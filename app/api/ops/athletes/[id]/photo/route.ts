import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOpsSession } from "@/lib/ops-access";
import {
  ATHLETE_PHOTO_MAX_BYTES,
  isAllowedAthletePhotoMime,
  removeAthletePhotoFiles,
  saveAthletePhotoFile,
} from "@/lib/athlete-photo-storage";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const { id } = await context.params;
  const existing = await prisma.opsAthlete.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Athlete not found" }, { status: 404 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("photo");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Photo file required" }, { status: 400 });
  }

  if (!isAllowedAthletePhotoMime(file.type)) {
    return NextResponse.json(
      { error: "Photo must be JPEG, PNG, WebP, or GIF" },
      { status: 400 }
    );
  }
  if (file.size > ATHLETE_PHOTO_MAX_BYTES) {
    return NextResponse.json({ error: "Photo must be 1 MB or smaller" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const photoPath = await saveAthletePhotoFile(id, file.type, bytes);
  const profilePhotoUrl = `${photoPath}?v=${Date.now()}`;

  const athlete = await prisma.opsAthlete.update({
    where: { id },
    data: { profilePhotoUrl },
    select: { id: true, profilePhotoUrl: true },
  });

  return NextResponse.json({ profilePhotoUrl: athlete.profilePhotoUrl, photoUrl: athlete.profilePhotoUrl });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const { id } = await context.params;
  const existing = await prisma.opsAthlete.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Athlete not found" }, { status: 404 });

  await removeAthletePhotoFiles(id);
  await prisma.opsAthlete.update({
    where: { id },
    data: { profilePhotoUrl: null },
  });

  return NextResponse.json({ ok: true });
}
