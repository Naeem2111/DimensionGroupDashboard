import { PageHeader } from "@/components/PageHeader";
import { AthleteBookCallClient } from "./AthleteBookCallClient";

export default function BookCallPage() {
  return (
    <div>
      <PageHeader
        title="Book a call"
        description="Request a check-in — same form as Daily Log. Jethro arranges the meeting and marks it scheduled."
      />
      <AthleteBookCallClient />
    </div>
  );
}
