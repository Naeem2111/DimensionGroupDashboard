import { PageHeader } from "@/components/PageHeader";
import { OpsOverviewClient } from "./OpsOverviewClient";

export default function OpsHomePage() {
  return (
    <>
      <PageHeader
        title="Athlete operations"
        badge="Operations"
        description="Production tracking, athlete performance, and project operations — overview, submissions, and commercial reporting."
        className="mb-8"
      />
      <OpsOverviewClient />
    </>
  );
}
