import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { OpsUrgencyStatus } from "@prisma/client";
import { pendingCheckInAthleteIds } from "@/lib/check-in-admin";
import { requireOpsSession } from "@/lib/ops-access";
import { parseDateOnly } from "@/lib/ops-hours";
import { parseSubmissionLineItems } from "@/lib/ops-submission-mutate";
import { syncProjectProgressForProjects } from "@/lib/sync-project-progress";
import { projectDisplayFields } from "@/lib/project-display";

export async function GET(request: NextRequest) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const limit = Math.min(500, Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") || "200", 10)));
  const projectId = request.nextUrl.searchParams.get("projectId")?.trim() || null;
  const athleteId = request.nextUrl.searchParams.get("athleteId")?.trim() || null;

  const submissions = await prisma.opsDailySubmission.findMany({
    where: {
      ...(athleteId ? { athleteId } : {}),
      ...(projectId ? { lineItems: { some: { projectId } } } : {}),
    },
    orderBy: [{ submissionDate: "desc" }, { updatedAt: "desc" }],
    take: limit,
    include: {
      athlete: {
        select: {
          id: true,
          fullName: true,
          athleteCode: true,
          profilePhotoUrl: true,
          profilePhotoBgColor: true,
          profilePhotoTextTone: true,
        },
      },
      lineItems: {
        include: {
          project: { select: { id: true, name: true, currentStage: true, projectNumber: true } },
          client: { select: { id: true, name: true, logoUrl: true, logoBgColor: true, logoTextTone: true } },
        },
      },
    },
  });

  const pendingAthletes = await pendingCheckInAthleteIds();

  return NextResponse.json({
    submissions: submissions.map((s) => ({
      id: s.id,
      athleteId: s.athleteId,
      athleteName: s.athlete.fullName,
      athleteCode: s.athlete.athleteCode,
      profilePhotoUrl: s.athlete.profilePhotoUrl,
      profilePhotoBgColor: s.athlete.profilePhotoBgColor,
      profilePhotoTextTone: s.athlete.profilePhotoTextTone,
      submissionDate: s.submissionDate.toISOString().slice(0, 10),
      totalHours: Number(s.totalHours),
      wellbeingScore: s.wellbeingScore,
      checkInRequested: s.checkInRequested,
      checkInNeedsAction: s.checkInRequested && pendingAthletes.has(s.athleteId),
      dailyNote: s.dailyNote,
      isBackloggedSession: s.isBackloggedSession,
      lockedAt: s.lockedAt?.toISOString() ?? null,
      updatedAt: s.updatedAt.toISOString(),
      lineItems: s.lineItems.map((li) => {
        if (li.isHousekeeping || !li.project) {
          return {
            id: li.id,
            clientId: li.clientId,
            projectId: li.projectId,
            isHousekeeping: true,
            projectName: "Client housekeeping",
            projectDisplayTitle: "Client housekeeping",
            projectNumber: "—",
            clientName: li.client.name,
            clientLogoUrl: li.client.logoUrl,
            clientLogoBgColor: li.client.logoBgColor,
            clientLogoTextTone: li.client.logoTextTone,
            projectPhase: li.projectPhase,
            taskType: li.taskType,
            taskTypes: li.taskTypes?.length ? li.taskTypes : [li.taskType],
            hoursWorked: Number(li.hoursWorked),
            completionPercent: li.completionPercent,
            completedSummary: li.completedSummary,
            notes: li.notes,
          };
        }
        const { displayTitle } = projectDisplayFields(li.project);
        return {
          id: li.id,
          clientId: li.clientId,
          projectId: li.projectId,
          isHousekeeping: false,
          projectName: li.project.name,
          projectDisplayTitle: displayTitle,
          projectNumber: li.project.projectNumber,
          clientName: li.client.name,
          clientLogoUrl: li.client.logoUrl,
          clientLogoBgColor: li.client.logoBgColor,
          clientLogoTextTone: li.client.logoTextTone,
          projectPhase: li.projectPhase,
          taskType: li.taskType,
          taskTypes: li.taskTypes?.length ? li.taskTypes : [li.taskType],
          hoursWorked: Number(li.hoursWorked),
          completionPercent: li.completionPercent,
          blockerFlag: li.blockerFlag,
          blockerNote: li.blockerNote,
          completedSummary: li.completedSummary,
          notes: li.notes,
        };
      }),
    })),
  });
}
