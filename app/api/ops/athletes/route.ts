import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { requireOpsSession } from "@/lib/ops-access";
import { parseDateOnly } from "@/lib/ops-hours";
import { parseImageUrlField } from "@/lib/image-url";
import { parseHexColor } from "@/lib/hex-color";
import { parseAvatarTextTone } from "@/lib/avatar-text-tone";
import { ensureAthleteSystemBoards } from "@/lib/planner-system-boards";

export async function GET(request: NextRequest) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const athletes = await prisma.opsAthlete.findMany({
    orderBy: { fullName: "asc" },
    include: {
      user: { select: { id: true, username: true, disabled: true } },
      _count: { select: { projects: true, submissions: true } },
    },
  });

  return NextResponse.json({
    athletes: athletes.map((a) => ({
      id: a.id,
      userId: a.userId,
      username: a.user.username,
      fullName: a.fullName,
      athleteCode: a.athleteCode,
      email: a.email,
      status: a.status,
      baseMonthlyPayZar: Number(a.baseMonthlyPayZar),
      monthlyHourCap: a.monthlyHourCap,
      overtimeRateZar: Number(a.overtimeRateZar),
      blocharchStartDate: a.blocharchStartDate.toISOString().slice(0, 10),
      profilePhotoUrl: a.profilePhotoUrl,
      profilePhotoBgColor: a.profilePhotoBgColor,
      profilePhotoTextTone: a.profilePhotoTextTone,
      projectCount: a._count.projects,
      submissionCount: a._count.submissions,
    })),
  });
}

export async function POST(request: NextRequest) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  try {
    const body = await request.json();
    const fullName = String(body.fullName || "").trim();
    const athleteCode = String(body.athleteCode || "").trim().toUpperCase();
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "").trim();
    const startRaw = String(body.blocharchStartDate || "").trim();
    const startDate = parseDateOnly(startRaw) ?? new Date();

    if (fullName.length < 2) {
      return NextResponse.json({ error: "Full name required" }, { status: 400 });
    }
    if (athleteCode.length < 2) {
      return NextResponse.json({ error: "Athlete code required" }, { status: 400 });
    }
    if (username.length < 2) {
      return NextResponse.json({ error: "Username required" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const exists = await prisma.user.findUnique({ where: { username } });
    if (exists) {
      return NextResponse.json({ error: "Username already exists" }, { status: 400 });
    }

    const codeExists = await prisma.opsAthlete.findUnique({ where: { athleteCode } });
    if (codeExists) {
      return NextResponse.json({ error: "Athlete code already exists" }, { status: 400 });
    }

    let profilePhotoUrl: string | null | undefined;
    try {
      profilePhotoUrl = parseImageUrlField(body.profilePhotoUrl);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Invalid profile photo URL" },
        { status: 400 }
      );
    }

    let profilePhotoBgColor: string | null | undefined;
    if (body.profilePhotoBgColor !== undefined) {
      const parsed = parseHexColor(body.profilePhotoBgColor);
      if (body.profilePhotoBgColor !== null && body.profilePhotoBgColor !== "" && !parsed) {
        return NextResponse.json({ error: "Invalid profile background colour" }, { status: 400 });
      }
      profilePhotoBgColor = parsed;
    }

    let profilePhotoTextTone: string | null | undefined;
    if (body.profilePhotoTextTone !== undefined) {
      const parsed = parseAvatarTextTone(body.profilePhotoTextTone);
      if (body.profilePhotoTextTone !== null && body.profilePhotoTextTone !== "" && parsed === null) {
        return NextResponse.json({ error: "Profile text colour must be light or dark" }, { status: 400 });
      }
      profilePhotoTextTone = parsed;
    }

    const userId = randomUUID();
    const athlete = await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: userId,
          username,
          passwordHash: hashPassword(password),
          role: "user",
          disabled: false,
        },
      });
      const created = await tx.opsAthlete.create({
        data: {
          userId,
          fullName,
          athleteCode,
          email: body.email ? String(body.email).trim() : null,
          phone: body.phone ? String(body.phone).trim() : null,
          blocharchStartDate: startDate,
          baseMonthlyPayZar: body.baseMonthlyPayZar ?? 20000,
          monthlyHourCap: body.monthlyHourCap ?? 160,
          overtimeRateZar: body.overtimeRateZar ?? 200,
          ...(profilePhotoUrl !== undefined ? { profilePhotoUrl } : {}),
          ...(profilePhotoBgColor !== undefined ? { profilePhotoBgColor } : {}),
          ...(profilePhotoTextTone !== undefined ? { profilePhotoTextTone } : {}),
        },
      });
      await ensureAthleteSystemBoards(created.id, userId, tx);
      return created;
    });

    return NextResponse.json(
      { athlete: { id: athlete.id, username, athleteCode, fullName } },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
