import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccessModule, defaultDashboardPath } from "@/lib/permissions";
import { OpsShell } from "@/components/ops/OpsShell";

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || !canAccessModule(session.user.role, "ops")) {
    redirect(defaultDashboardPath(session?.user.role ?? "user"));
  }
  return <OpsShell>{children}</OpsShell>;
}
