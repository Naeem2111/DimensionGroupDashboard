import { PageHeader } from "@/components/PageHeader";
import { AnalyticsClient } from "./AnalyticsClient";

export default function OpsAnalyticsPage() {
  return (
    <>
      <PageHeader
        title="Analytics"
        description="Hours breakdown, profitability, and due-date risk across athletes and clients."
        className="mb-8"
      />
      <AnalyticsClient />
    </>
  );
}
