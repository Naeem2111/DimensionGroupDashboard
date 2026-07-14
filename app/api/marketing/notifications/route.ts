import { listMarketingNotifications } from "@/lib/lead-outreach";

export async function GET() {
  const items = await listMarketingNotifications();
  return Response.json({ items, total: items.length });
}
