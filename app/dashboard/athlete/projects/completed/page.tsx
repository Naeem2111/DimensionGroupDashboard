import { PageHeader } from "@/components/PageHeader";
import { CompletedProjectsClient } from "./CompletedProjectsClient";

export default function CompletedProjectsPage() {
  return (
    <div>
      <PageHeader
        title="Completed projects"
        description="Finished client projects — separate from the Completed Kanban board for individual tasks."
      />
      <CompletedProjectsClient />
    </div>
  );
}
