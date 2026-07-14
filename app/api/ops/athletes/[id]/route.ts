import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { requireOpsSession } from "@/lib/ops-access";
import { parseDateOnly } from "@/lib/ops-hours";
import { parseImageUrlField } from "@/lib/image-url";
import { parseHexColor } from "@/lib/hex-color";
import { parseAvatarTextTone } from "@/lib/avatar-text-tone";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const { id } = await context.params;
  const existing = await prisma.opsAthlete.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!existing) return NextResponse.json({ error: "Athlete not found" }, { status: 404 });

  try {
    const body = await request.json();
    const athleteData: Record<string, unknown> = {};

    if (body.fullName != null) {
      const fullName = String(body.fullName).trim();
      if (fullName.length < 2) return NextResponse.json({ error: "Invalid full name" }, { status: 400 });
      athleteData.fullName = fullName;
    }
    if (body.email !== undefined) athleteData.email = body.email ? String(body.email).trim() : null;
    if (body.status === "active" || body.status === "inactive") athleteData.status = body.status;
    if (body.baseMonthlyPayZar != null) athleteData.baseMonthlyPayZar = Math.max(0, Number(body.baseMonthlyPayZar) || 0);
    if (body.monthlyHourCap != null)
      athleteData.monthlyHourCap = Math.max(1, Math.round(Number(body.monthlyHourCap) || 160));
    if (body.overtimeRateZar != null) athleteData.overtimeRateZar = Math.max(0, Number(body.overtimeRateZar) || 0);
    if (body.blocharchStartDate != null) {
      const d = parseDateOnly(String(body.blocharchStartDate));
      if (!d) return NextResponse.json({ error: "Invalid start date" }, { status: 400 });
      athleteData.blocharchStartDate = d;
    }
    if (body.profilePhotoUrl !== undefined) {
      try {
        athleteData.profilePhotoUrl = parseImageUrlField(body.profilePhotoUrl) ?? null;
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Invalid profile photo URL" },
          { status: 400 }
        );
      }
    }

    if (body.profilePhotoBgColor !== undefined) {
      const parsed = parseHexColor(body.profilePhotoBgColor);
      if (body.profilePhotoBgColor !== null && body.profilePhotoBgColor !== "" && !parsed) {
        return NextResponse.json({ error: "Invalid profile background colour" }, { status: 400 });
      }
      athleteData.profilePhotoBgColor = parsed;
    }

    if (body.profilePhotoTextTone !== undefined) {
      const parsed = parseAvatarTextTone(body.profilePhotoTextTone);
      if (body.profilePhotoTextTone !== null && body.profilePhotoTextTone !== "" && parsed === null) {
        return NextResponse.json({ error: "Profile text colour must be light or dark" }, { status: 400 });
      }
      athleteData.profilePhotoTextTone = parsed;
    }

    const userData: { disabled?: boolean; passwordHash?: string } = {};
    if (body.disabled != null) userData.disabled = Boolean(body.disabled);
    if (body.password != null) {
      const password = String(body.password).trim();
      if (password.length > 0) {
        if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
        userData.passwordHash = hashPassword(password);
      }
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(athleteData).length > 0) {
        await tx.opsAthlete.update({ where: { id }, data: athleteData });
      }
      if (Object.keys(userData).length > 0) {
        await tx.user.update({ where: { id: existing.userId }, data: userData });
      }
    });

    const athlete = await prisma.opsAthlete.findUniqueOrThrow({
      where: { id },
      include: { user: { select: { username: true, disabled: true } }, _count: { select: { projects: true } } },
    });

    return NextResponse.json({
      athlete: {
        id: athlete.id,
        username: athlete.user.username,
        fullName: athlete.fullName,
        athleteCode: athlete.athleteCode,
        email: athlete.email,
        status: athlete.status,
        disabled: athlete.user.disabled,
        baseMonthlyPayZar: Number(athlete.baseMonthlyPayZar),
        monthlyHourCap: athlete.monthlyHourCap,
        overtimeRateZar: Number(athlete.overtimeRateZar),
        blocharchStartDate: athlete.blocharchStartDate.toISOString().slice(0, 10),
        profilePhotoUrl: athlete.profilePhotoUrl,
        profilePhotoBgColor: athlete.profilePhotoBgColor,
        profilePhotoTextTone: athlete.profilePhotoTextTone,
        projectCount: athlete._count.projects,
      },
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const { id } = await context.params;
  const existing = await prisma.opsAthlete.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Athlete not found" }, { status: 404 });

  await prisma.$transaction([
    prisma.opsAthlete.delete({ where: { id } }),
    prisma.user.delete({ where: { id: existing.userId } }),
  ]);

  return NextResponse.json({ ok: true });
}
