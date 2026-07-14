import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccessModule, defaultDashboardPath } from "@/lib/permissions";

export default async function AdminSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || !canAccessModule(session.user.role, "admin")) {
    redirect(defaultDashboardPath(session?.user.role ?? "user"));
  }
  return children;
}
