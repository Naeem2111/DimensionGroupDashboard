import type { PrismaClient } from "@prisma/client";

export async function validateProjectLeadContactDb(
  prisma: PrismaClient,
  clientId: string,
  contactId: string | null | undefined
): Promise<string | null> {
  if (!contactId) return null;
  const contact = await prisma.opsClientContact.findFirst({
    where: { id: contactId, clientId },
    select: { id: true },
  });
  if (!contact) return "Office lead must belong to this client";
  return null;
}
