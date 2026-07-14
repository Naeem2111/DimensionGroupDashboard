import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canViewBoard, requirePlannerSession } from "@/lib/planner-access";

type Ctx = { params: Promise<{ boardId: string }> };

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
}

export async function GET(request: NextRequest, context: Ctx) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;
  const { boardId } = await context.params;

  if (!(await canViewBoard(user, boardId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const board = await prisma.plannerBoard.findUnique({
    where: { id: boardId },
    include: {
      columns: {
        include: {
          tasks: {
            where: { dueAt: { not: null } },
            orderBy: { dueAt: "asc" },
          },
        },
      },
    },
  });
  if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Blocharch//Project planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(board.title)}`,
  ];

  for (const col of board.columns) {
    for (const t of col.tasks) {
      if (!t.dueAt) continue;
      const uid = `${t.id}@blocarch-planner`;
      const start = t.dueAt;
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const fmt = (d: Date) =>
        d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${fmt(new Date())}`);
      lines.push(`DTSTART:${fmt(start)}`);
      lines.push(`DTEND:${fmt(end)}`);
      lines.push(`SUMMARY:${icsEscape(t.title)}`);
      const desc = [t.summary, t.description, t.architectUrl ? `Lead: ${t.architectUrl}` : ""]
        .filter(Boolean)
        .join("\\n\\n");
      if (desc) lines.push(`DESCRIPTION:${icsEscape(desc)}`);
      lines.push("END:VEVENT");
    }
  }

  lines.push("END:VCALENDAR");

  const body = lines.join("\r\n") + "\r\n";

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(board.title)}-planner.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
