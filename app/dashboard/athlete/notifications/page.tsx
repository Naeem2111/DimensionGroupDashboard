import { PageHeader } from "@/components/PageHeader";
import { AthleteNotificationsClient } from "./AthleteNotificationsClient";

export default function AthleteNotificationsPage() {
  return (
    <div>
      <PageHeader
        title="My notifications"
        description="Check-in updates, new assigned tasks, and project messages from Blocharch."
      />
      <AthleteNotificationsClient />
    </div>
  );
}
