import { PageHeader } from "@/components/PageHeader";
import { OpsSubmissionsClient } from "./OpsSubmissionsClient";

export default function OpsSubmissionsPage() {
  return (
    <div>
      <PageHeader
        title="Daily submissions"
        description="All athlete daily logs — hours, progress, blockers, and check-in flags across every project."
      />
      <OpsSubmissionsClient />
    </div>
  );
}
