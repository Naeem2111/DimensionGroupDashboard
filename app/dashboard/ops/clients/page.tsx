import { PageHeader } from "@/components/PageHeader";
import { OpsClientsClient } from "./OpsClientsClient";

export default function OpsClientsPage() {
  return (
    <>
      <PageHeader
        title="Client manager"
        description="Each client is billed per lane per month (tier rate × lane count). Projects track hours against that lane capacity."
        className="mb-8"
      />
      <OpsClientsClient />
    </>
  );
}
