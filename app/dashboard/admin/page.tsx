import { PageHeader } from "@/components/PageHeader";
import { getSession } from "@/lib/auth";
import { AdminUsersClient } from "./AdminUsersClient";

export default async function AdminPage() {
  const session = await getSession();
  const currentUserId = session?.user.id ?? "";

  return (
    <>
      <PageHeader
        title="Users & access"
        description="Create accounts, assign roles, reset passwords, and revoke access. Only administrators can use this page."
        badge="Admin"
      />
      <AdminUsersClient currentUserId={currentUserId} />
    </>
  );
}
