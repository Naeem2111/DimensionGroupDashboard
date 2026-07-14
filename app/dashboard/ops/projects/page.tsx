import { PageHeader } from "@/components/PageHeader";
import { OpsProjectsClient } from "./OpsProjectsClient";

export default function OpsProjectsPage() {
  return (
    <>
      <PageHeader
        title="Project operations tracker"
        description="Monitor all live projects — status, stages, deadlines, blockers, and latest activity."
        className="mb-8"
      />
      <OpsProjectsClient />
    </>
  );
}
