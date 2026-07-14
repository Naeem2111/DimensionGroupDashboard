import { Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getSession } from "@/lib/auth";
import { provisionMissingPlannerBoards } from "@/lib/planner-provision";
import { PlannerClient } from "./PlannerClient";

export default async function PlannerPage() {
  const session = await getSession();
  if (session?.user.role === "admin") {
    await provisionMissingPlannerBoards().catch(() => {});
  }

  return (
    <div className="mx-auto w-full max-w-[90rem]">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Project planner"
          description="Personal boards for your work, or Team to open an athlete workspace and Kanban. Fixed system boards (Inbox, My Tasks, Completed) cannot be removed by athletes."
        />
        <ThemeToggle compact />
      </div>
      <Suspense fallback={<p className="text-slate-500 text-sm">Loading planner…</p>}>
        <PlannerClient />
      </Suspense>
    </div>
  );
}
