import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { defaultDashboardPath } from "@/lib/permissions";
import { LoginPageClient } from "./LoginPageClient";

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect(defaultDashboardPath(session.user.role));
  }
  return <LoginPageClient />;
}
