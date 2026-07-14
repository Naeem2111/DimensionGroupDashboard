import { PageHeader } from "@/components/PageHeader";
import { AthleteDashboardClient } from "./AthleteDashboardClient";

export default function AthleteHomePage() {
  return (
    <>
      <PageHeader
        title="My dashboard"
        badge="Athlete"
        description="Your hours, earnings, active projects, and daily work — all in one place."
        className="mb-8"
      />
      <AthleteDashboardClient />
    </>
  );
}
