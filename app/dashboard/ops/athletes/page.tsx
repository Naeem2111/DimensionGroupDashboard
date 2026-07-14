import { PageHeader } from "@/components/PageHeader";
import { OpsAthletesClient } from "./OpsAthletesClient";

export default function OpsAthletesPage() {
  return (
    <>
      <PageHeader
        title="Athlete manager"
        description="Create athlete accounts, set base pay (ZAR), hour caps, overtime rates, and assign lanes."
        className="mb-8"
      />
      <OpsAthletesClient />
    </>
  );
}
