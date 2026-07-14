import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { ThemeBootstrap } from "@/components/ThemeBootstrap";
import { getSession } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <>
      <ThemeBootstrap theme={session.user.theme} />
      <DashboardShell user={session.user}>{children}</DashboardShell>
    </>
  );
}
