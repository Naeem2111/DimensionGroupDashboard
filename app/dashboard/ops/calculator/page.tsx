import { PageHeader } from "@/components/PageHeader";
import { OnboardingCalculatorClient } from "./OnboardingCalculatorClient";

export default function OpsCalculatorPage() {
  return (
    <>
      <PageHeader
        title="Sales calculator"
        description="Quote the BLOCHARCH monthly fee during sales calls from the client's benchmark cost and agreed cost-saving percentage."
        className="mb-8"
      />
      <OnboardingCalculatorClient />
    </>
  );
}
