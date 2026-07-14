import { PageHeader } from "@/components/PageHeader";
import { AthleteProjectsClient } from "./AthleteProjectsClient";

export default function AthleteProjectsPage() {
  return (
    <>
      <PageHeader
        title="My projects"
        description="All projects assigned to you — synced with the admin operations tracker."
        className="mb-8"
      />
      <AthleteProjectsClient />
    </>
  );
}
