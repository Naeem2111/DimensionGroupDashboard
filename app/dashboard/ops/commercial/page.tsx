import { PageHeader } from "@/components/PageHeader";
import { CommercialClient } from "./CommercialClient";

export default function OpsCommercialPage() {
  return (
    <>
      <PageHeader
        title="Commercial dashboard"
        description="Clients are billed per lane per month. Projects track hours against lane capacity; lane fees appear here as soon as a client has lanes configured."
        className="mb-8"
      />
      <CommercialClient />
    </>
  );
}
