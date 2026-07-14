import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlannerSession } from "@/lib/planner-access";

export async function GET(request: NextRequest) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;

  const users = await prisma.user.findMany({
    where: { disabled: false },
    orderBy: { username: "asc" },
    select: { id: true, username: true, role: true },
  });

  return NextResponse.json({ users });
}
