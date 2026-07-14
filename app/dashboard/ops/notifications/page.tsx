import { redirect } from "next/navigation";

/** Ops notifications removed — all check-ins live under Check-in requests. */
export default function OpsNotificationsPage() {
  redirect("/dashboard/ops/check-ins");
}
