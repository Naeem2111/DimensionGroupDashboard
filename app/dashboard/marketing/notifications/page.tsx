import { MarketingNotificationsClient } from "./MarketingNotificationsClient";

export default function MarketingNotificationsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Marketing notifications</h1>
        <p className="mt-1 text-sm text-slate-400">Follow-up reminders for manual lead outreach</p>
      </div>
      <MarketingNotificationsClient />
    </div>
  );
}
