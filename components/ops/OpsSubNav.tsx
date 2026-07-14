"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type OpsNavItem = {
  href: string;
  label: string;
  badgeKey?: "checkIns" | "submissionCheckIns";
};

export const OPS_NAV: OpsNavItem[] = [
  { href: "/dashboard/ops", label: "Overview" },
  { href: "/dashboard/ops/submissions", label: "Daily submissions", badgeKey: "submissionCheckIns" },
  { href: "/dashboard/ops/projects", label: "Projects" },
  { href: "/dashboard/ops/archives", label: "Project archives" },
  { href: "/dashboard/ops/commercial", label: "Commercial" },
  { href: "/dashboard/ops/check-ins", label: "Check-in requests", badgeKey: "checkIns" },
  { href: "/dashboard/ops/analytics", label: "Analytics" },
];

type OpsBadges = {
  checkIns?: number;
  submissionCheckIns?: number;
};

function navActive(pathname: string, href: string): boolean {
  return href === "/dashboard/ops"
    ? pathname === "/dashboard/ops"
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function OpsSubNav({ pathname }: { pathname: string }) {
  const [badges, setBadges] = useState<OpsBadges>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const r = await fetch("/api/ops/sidebar-badges");
      const j = await r.json().catch(() => ({}));
      if (!cancelled && r.ok) {
        setBadges({
          checkIns: j.checkIns ?? 0,
          submissionCheckIns: j.submissionCheckIns ?? 0,
        });
      }
    }
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return (
    <nav
      className="mb-6 flex gap-2 overflow-x-auto border-b border-white/[0.06] pb-4 [-ms-overflow-style:none] [scrollbar-width:none] md:mb-8 md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden"
      aria-label="Athlete operations"
    >
      {OPS_NAV.map((item) => {
        const active = navActive(pathname, item.href);
        const badge = item.badgeKey ? badges[item.badgeKey] ?? 0 : 0;
        const urgent = !active && badge > 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ring-1 transition-colors ${
              active
                ? "bg-brand-500/20 text-brand-200 ring-brand-500/30"
                : urgent
                  ? "animate-pulse bg-red-500/10 text-red-200 ring-red-500/35 hover:bg-red-500/15"
                  : "bg-white/[0.04] text-slate-400 ring-white/[0.08] hover:bg-white/[0.07]"
            }`}
          >
            {item.label}
            {badge > 0 ? (
              <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                {badge > 99 ? "99+" : badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
