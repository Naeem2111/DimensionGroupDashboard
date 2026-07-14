import { PageHeader } from "@/components/PageHeader";
import { OpsArchivesClient } from "./OpsArchivesClient";

export default function OpsArchivesPage() {
  return (
    <>
      <PageHeader
        title="Project archives"
        description="Historical completed projects, kanban tasks, and daily log completions — filter by client or athlete to see who finished what."
        className="mb-8"
      />
      <OpsArchivesClient />
    </>
  );
}
