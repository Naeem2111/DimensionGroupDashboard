"use client";

import { usePathname } from "next/navigation";
import { OnboardingSubNav, isOnboardingPath } from "./OnboardingSubNav";
import { OpsSubNav } from "./OpsSubNav";

export function OpsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const onboarding = isOnboardingPath(pathname);
  return (
    <div className="mx-auto w-full max-w-[90rem]">
      {onboarding ? <OnboardingSubNav pathname={pathname} /> : <OpsSubNav pathname={pathname} />}
      {children}
    </div>
  );
}
