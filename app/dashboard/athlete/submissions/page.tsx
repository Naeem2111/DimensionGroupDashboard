import { PageHeader } from "@/components/PageHeader";
import { AthleteSubmissionsClient } from "./AthleteSubmissionsClient";

export default function AthleteSubmissionsPage() {
  return (
    <>
      <PageHeader
        title="Daily log"
        description="Submit one log per day with multiple project entries — phase, task type, hours, and blockers."
        className="mb-8"
      />
      <AthleteSubmissionsClient />
    </>
  );
}
