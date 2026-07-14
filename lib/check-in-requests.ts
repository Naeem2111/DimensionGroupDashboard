import type { OpsCheckInRequest } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createGoogleCalendarEvent, patchGoogleCalendarEvent } from "@/lib/google-calendar";

export function serializeCheckInRequest(
  row: OpsCheckInRequest & {
    athlete: {
      fullName: string;
      athleteCode: string;
      email: string | null;
      profilePhotoUrl?: string | null;
      profilePhotoBgColor?: string | null;
      profilePhotoTextTone?: string | null;
    };
    project: { name: string; client: { name: string } } | null;
  }
) {
  return {
    id: row.id,
    source: row.source,
    athleteId: row.athleteId,
    athleteName: row.athlete.fullName,
    athleteCode: row.athlete.athleteCode,
    athleteEmail: row.athlete.email,
    profilePhotoUrl: row.athlete.profilePhotoUrl ?? null,
    profilePhotoBgColor: row.athlete.profilePhotoBgColor ?? null,
    profilePhotoTextTone: row.athlete.profilePhotoTextTone ?? null,
    projectId: row.projectId,
    projectName: row.project?.name ?? null,
    clientName: row.project?.client?.name ?? null,
    reason: row.reason,
    contextNotes: row.contextNotes,
    requestedStartAt: row.requestedStartAt.toISOString(),
    requestedEndAt: row.requestedEndAt.toISOString(),
    status: row.status,
    adminNote: row.adminNote,
    counterStartAt: row.counterStartAt?.toISOString() ?? null,
    counterEndAt: row.counterEndAt?.toISOString() ?? null,
    zoomLink: row.zoomLink,
    googleEventId: row.googleEventId,
    googleEventLink: row.googleEventLink,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function loadCheckInRequest(id: string) {
  return prisma.opsCheckInRequest.findUnique({
    where: { id },
    include: {
      athlete: {
        select: {
          fullName: true,
          athleteCode: true,
          email: true,
          profilePhotoUrl: true,
          profilePhotoBgColor: true,
          profilePhotoTextTone: true,
        },
      },
      project: { include: { client: { select: { name: true } } } },
    },
  });
}

function eventTitle(athleteName: string, projectName: string | null): string {
  return projectName
    ? `Blocharch check-in: ${athleteName} — ${projectName}`
    : `Blocharch check-in: ${athleteName}`;
}

function eventDescription(row: {
  reason: string;
  contextNotes: string | null;
  adminNote: string | null;
  zoomLink: string | null;
}): string {
  const parts = [`Reason: ${row.reason}`];
  if (row.contextNotes?.trim()) parts.push(`Athlete notes: ${row.contextNotes.trim()}`);
  if (row.adminNote?.trim()) parts.push(`Admin: ${row.adminNote.trim()}`);
  if (row.zoomLink?.trim()) parts.push(`Zoom: ${row.zoomLink.trim()}`);
  return parts.join("\n\n");
}

export async function createCheckInCalendarEvent(
  row: OpsCheckInRequest & {
    athlete: { fullName: string; email: string | null };
    project: { name: string } | null;
  },
  start: Date,
  end: Date
) {
  const created = await createGoogleCalendarEvent({
    title: eventTitle(row.athlete.fullName, row.project?.name ?? null),
    description: eventDescription(row),
    start,
    end,
    attendeeEmail: row.athlete.email,
  });

  if (!created) return { googleEventId: null as string | null, googleEventLink: null as string | null };

  return { googleEventId: created.eventId, googleEventLink: created.htmlLink };
}

export async function syncCalendarEventDescription(
  googleEventId: string,
  row: { reason: string; contextNotes: string | null; adminNote: string | null; zoomLink: string | null }
) {
  await patchGoogleCalendarEvent(googleEventId, {
    description: eventDescription(row),
  });
}
