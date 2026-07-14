import Link from "next/link";

export type AthleteNavItem = {
  href: string;
  label: string;
};

export const ATHLETE_NAV: AthleteNavItem[] = [
  { href: "/dashboard/athlete", label: "My dashboard" },
  { href: "/dashboard/athlete/submissions", label: "Daily log" },
  { href: "/dashboard/athlete/projects", label: "My projects" },
  { href: "/dashboard/athlete/projects/completed", label: "Completed projects" },
  { href: "/dashboard/athlete/notifications", label: "My notifications" },
  { href: "/dashboard/athlete/book-call", label: "Book a call" },
  { href: "/dashboard/planner?area=team&athlete=me", label: "Project planner" },
];

export function AthleteSubNav({ pathname }: { pathname: string }) {
  return (
    <nav
      className="mb-6 flex gap-2 overflow-x-auto border-b border-white/[0.06] pb-4 [-ms-overflow-style:none] [scrollbar-width:none] md:mb-8 md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden"
      aria-label="Athlete workspace"
    >
      {ATHLETE_NAV.map((item) => {
        const active =
          item.href === "/dashboard/athlete"
            ? pathname === "/dashboard/athlete"
            : item.href.startsWith("/dashboard/planner")
              ? pathname.startsWith("/dashboard/planner")
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ring-1 transition-colors ${
              active
                ? "bg-brand-500/20 text-brand-200 ring-brand-500/30"
                : "bg-white/[0.04] text-slate-400 ring-white/[0.08] hover:bg-white/[0.07]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
