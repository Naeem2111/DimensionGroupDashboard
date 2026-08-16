import { PageHeader } from "@/components/PageHeader";
import { AutomationClient } from "./AutomationClient";

export default function AutomationPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Lead nurturing"
        description="Manual outreach — compose autofilled emails in your mail app, log follow-ups and replies. Add practices with name and email anytime."
      />
      <AutomationClient />
    </div>
  );
}
