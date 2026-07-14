import { PageHeader } from "@/components/PageHeader";
import { OpsCheckInRequestsClient } from "./OpsCheckInRequestsClient";

export default function OpsCheckInsPage() {
  return (
    <div>
      <PageHeader
        title="Check-in requests"
        description="Unified check-in requests from Book a Call and Daily Log — mark Pending / Unscheduled or Scheduled after you arrange the meeting."
      />
      <OpsCheckInRequestsClient />
    </div>
  );
}
