import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccessModule, defaultDashboardPath } from "@/lib/permissions";
import { AthleteShell } from "@/components/ops/AthleteShell";
import { ensureLinkedAthleteProfile } from "@/lib/ops-athlete-profile";

export default async function AthleteLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || !canAccessModule(session.user.role, "athlete_portal")) {
    redirect(defaultDashboardPath(session?.user.role ?? "user"));
  }
  if (session.user.role === "admin") {
    await ensureLinkedAthleteProfile(session.user);
  }
  return <AthleteShell>{children}</AthleteShell>;
}
