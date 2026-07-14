import { notFound } from "next/navigation";
import Link from "next/link";
import { getBestAddress, loadArchitects } from "@/lib/architects";
import { gmailComposeUrl } from "@/lib/gmail-compose";
import { isManualPracticeUrl } from "@/lib/practice-url";
import { LeadStatus } from "@/components/LeadStatus";
import { LeadOutreachPanel } from "@/components/outreach/LeadOutreachPanel";
import { PracticeMap } from "@/components/PracticeMap";

function slugFromUrl(url: string): string {
  const m = url.match(/\/practice\/([^/]+)\/?$/);
  return m ? m[1] : "";
}

export default async function PracticeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const architects = await loadArchitects();
  const decoded = decodeURIComponent(slug);
  const practice = architects.find(
    (a) =>
      slugFromUrl(a.url) === decoded ||
      slugFromUrl(a.url) === slug ||
      a.url.endsWith("/" + decoded) ||
      a.url.endsWith("/" + slug)
  );

  if (!practice) notFound();
  const bestAddress = getBestAddress(practice);

  return (
    <div className="max-w-6xl mx-auto">
      <Link
        href="/dashboard/practices"
        className="inline-flex items-center text-slate-400 hover:text-white text-sm mb-6"
      >
        ← Back to practices
      </Link>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="card-tool overflow-hidden rounded-2xl ring-1 ring-white/[0.06]">
        <div className="border-b border-white/[0.06] p-6">
          <h1 className="text-2xl font-semibold text-white">{practice.name}</h1>
          {practice.website && (
            <a
              href={practice.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-400 hover:underline text-sm mt-1 inline-block"
            >
              {practice.website}
            </a>
          )}
        </div>
        <div className="p-6 space-y-4">
          {practice.email && (
            <div>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">
                Email
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <span className="text-slate-200 break-all">{practice.email}</span>
                <a
                  href={gmailComposeUrl(practice.email)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-fit shrink-0 items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.07] px-3 py-1.5 text-sm font-semibold text-slate-100 ring-1 ring-white/[0.06] transition-colors hover:bg-white/[0.11]"
                >
                  Open in Gmail
                </a>
              </div>
            </div>
          )}
          {practice.contact && (
            <div>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">
                Contact
              </p>
              <p className="text-slate-200">{practice.contact}</p>
            </div>
          )}
          {practice.phone && (
            <div>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">
                Contact number
              </p>
              <p className="text-slate-200">{practice.phone}</p>
            </div>
          )}
          {practice.address && (
            <div>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">
                Address
              </p>
              <p className="text-slate-200">{practice.address}</p>
            </div>
          )}
          {(practice.years_active || practice.staff) && (
            <div className="flex gap-8">
              {practice.years_active && (
                <div>
                  <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">
                    Years active
                  </p>
                  <p className="text-slate-200">{practice.years_active}</p>
                </div>
              )}
              {practice.staff && (
                <div>
                  <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">
                    Staff
                  </p>
                  <p className="text-slate-200">{practice.staff}</p>
                </div>
              )}
            </div>
          )}
          {practice.description && (
            <div>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">
                Description
              </p>
              <p className="text-slate-300 text-sm leading-relaxed">
                {practice.description}
              </p>
            </div>
          )}
          {practice.socials && practice.socials.length > 0 && (
            <div>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">
                Social links
              </p>
              <div className="flex flex-wrap gap-2">
                {practice.socials.map((s) => (
                  <a
                    key={s}
                    href={s}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-400 hover:underline text-sm"
                  >
                    {s}
                  </a>
                ))}
              </div>
            </div>
          )}
          <div className="pt-2">
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">
              Source
            </p>
            {isManualPracticeUrl(practice.url) ? (
              <p className="text-slate-400 text-sm">Added manually to Blocharch</p>
            ) : (
              <a
                href={practice.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-brand-400 text-sm"
              >
                {practice.url}
              </a>
            )}
          </div>
        </div>
          </div>
          <div className="card-tool mt-6 rounded-2xl p-6 ring-1 ring-white/[0.06]">
            <h2 className="text-lg font-semibold text-white mb-4">Outreach tracker</h2>
            <LeadOutreachPanel
              slug={decoded}
              practiceEmail={practice.email ?? undefined}
              practiceContact={practice.contact ?? undefined}
            />
          </div>
        </div>
        <div className="lg:col-span-1">
          <div className="space-y-6 sticky top-4">
            <div className="card-tool rounded-2xl p-6 ring-1 ring-white/[0.06]">
              <h2 className="text-lg font-semibold text-white mb-4">Lead nurturing</h2>
              <LeadStatus slug={decoded} />
            </div>
            {bestAddress?.trim() && (
              <div className="card-tool rounded-2xl p-6 ring-1 ring-white/[0.06]">
                <PracticeMap
                  name={practice.name}
                  address={bestAddress}
                  href={practice.website || practice.url}
                  heightClassName="h-[260px]"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
