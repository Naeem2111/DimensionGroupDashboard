"use client";

import { usePathname } from "next/navigation";
import { AthleteSubNav } from "./AthleteSubNav";

export function AthleteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  return (
    <div className="mx-auto w-full max-w-[90rem]">
      <AthleteSubNav pathname={pathname} />
      {children}
    </div>
  );
}
