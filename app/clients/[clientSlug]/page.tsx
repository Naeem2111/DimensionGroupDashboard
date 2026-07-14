import { notFound } from "next/navigation";
import { getPublicClientPortal } from "@/lib/public-client-portal";
import { ClientPortalClient } from "./ClientPortalClient";

export default async function ClientPortalPage({
  params,
}: {
  params: Promise<{ clientSlug: string }>;
}) {
  const { clientSlug } = await params;
  const data = await getPublicClientPortal(clientSlug);
  if (!data) notFound();

  return <ClientPortalClient data={data} slug={clientSlug} initialTab="tracker" />;
}
