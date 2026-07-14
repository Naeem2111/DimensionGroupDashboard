import Link from "next/link";
import { loadArchitects } from "@/lib/architects";
import { listMarketingFollowUpDates } from "@/lib/lead-outreach";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { MarketingOverviewCalendar } from "@/components/marketing/MarketingOverviewCalendar";

export default async function DashboardPage() {
  const architects = await loadArchitects();
  const followUpDates = await listMarketingFollowUpDates();
  const total = architects.length;
  const withEmail = architects.filter((a) => a.email?.trim()).length;
  const withWebsite = architects.filter((a) => a.website?.trim()).length;
  const mapReady = await prisma.architect.count({
    where: {
      latitude: { not: null },
      longitude: { not: null },
    },
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Overview"
        badge="Live"
        description="Blocharch marketing dashboard — architect directory and outreach pipeline backed by your database."
      />
      <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="card-tool rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total practices</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-white">{total}</p>
          <p className="mt-1 text-xs text-slate-500">In directory</p>
        </div>
        <div className="card-tool rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">With email</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-brand-400">{withEmail}</p>
          <p className="mt-1 text-xs text-slate-500">Ready for outreach</p>
        </div>
        <div className="card-tool rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">With website</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-amber-400/90">{withWebsite}</p>
          <p className="mt-1 text-xs text-slate-500">Has website URL</p>
        </div>
        <div className="card-tool rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Map coordinates</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-200">{mapReady}</p>
          <p className="mt-1 text-xs text-slate-500">
            Geocoded in database (of {total} in directory)
          </p>
        </div>
      </div>
      <div className="mb-10">
        <MarketingOverviewCalendar items={followUpDates} />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          href="/dashboard/practices"
          className="card-tool card-tool-hover group block rounded-2xl p-5 ring-1 ring-white/[0.06]"
        >
          <h3 className="font-semibold text-white group-hover:text-brand-300">Browse practices</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Search and filter architect and landscape practices from the directory.
          </p>
        </Link>
        <Link
          href="/dashboard/map"
          className="card-tool card-tool-hover group block rounded-2xl p-5 ring-1 ring-white/[0.06]"
        >
          <h3 className="font-semibold text-white group-hover:text-brand-300">Map view</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Explore practices by location; coordinates are read from the database.
          </p>
        </Link>
      </div>
    </div>
  );
}
