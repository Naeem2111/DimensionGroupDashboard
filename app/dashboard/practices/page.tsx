import { PageHeader } from "@/components/PageHeader";
import { PracticesClient } from "./PracticesClient";

export default function PracticesPage() {
  return (
    <div className="mx-auto max-w-[min(100%,90rem)]">
      <PageHeader
        title="Practices"
        description="Search the directory or add practices manually. Toggle columns to focus the table."
      />
      <PracticesClient />
    </div>
  );
}
