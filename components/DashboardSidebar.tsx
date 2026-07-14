"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { LogoutButton } from "@/components/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BLOCHARCH_SITE } from "@/lib/blocharch-brand";
import type { SessionUser } from "@/lib/auth";
import { canAccessModule, canAccessOpsOverview, type AppModule } from "@/lib/permissions";
import {
  applyItemOrder,
  applySectionOrder,
  loadSidebarNavOrder,
  reorderIds,
  saveSidebarNavOrder,
  type SidebarNavOrder,
} from "@/lib/sidebar-nav-order";

type NavItem = { href: string; label: string; icon: React.ReactNode; badgeKey?: string };

type NavSection = {
  id: string;
  label: string;
  module: AppModule;
  items: NavItem[];
};

const MARKETING_NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/practices",
    label: "Leads",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008H18v-.008zm0 3h.008v.008H18V18zm0 3h.008v.008H18v-.008z"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/map",
    label: "Map",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 6.75V15m6-6v8.25m.106-18.256c.746.393 1.196 1.192 1.196 2.042v15.638a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184m7.5 0v-.462c0-.41-.34-.75-.75-.75h-4.5c-.41 0-.75.34-.75.75v.462m4.5 0v.462c0 .41-.34.75-.75.75h-4.5a.75.75 0 01-.75-.75v-.462m4.5 0h-4.5"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/automation",
    label: "Lead nurturing",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/marketing/notifications",
    label: "Marketing notifications",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
        />
      </svg>
    ),
  },
];

const PLANNER_NAV: NavItem[] = [
  {
    href: "/dashboard/planner",
    label: "Project planner",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.096-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.58 2.58 0 00-.1-.664M6.75 7.5V9h6V7.5m-6 3h6v3.75H6.75V10.5z"
        />
      </svg>
    ),
  },
];

const ONBOARDING_NAV: NavItem[] = [
  {
    href: "/dashboard/ops/clients",
    label: "Clients",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008H18v-.008zm0 3h.008v.008H18V18zm0 3h.008v.008H18v-.008z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/ops/athletes",
    label: "Athletes",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/ops/calculator",
    label: "Calculator",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V12zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V18zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V12zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V18zm2.504-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V12zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V18zm2.498-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V12zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V18zM6 3.75A2.25 2.25 0 018.25 1.5h7.5A2.25 2.25 0 0118 3.75v16.5A2.25 2.25 0 0115.75 22.5h-7.5A2.25 2.25 0 016 20.25V3.75z" />
      </svg>
    ),
  },
];

const OPS_NAV: NavItem[] = [
  {
    href: "/dashboard/ops",
    label: "Ops overview",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6.75v6.75"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/ops/submissions",
    label: "Daily submissions",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 01-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/ops/projects",
    label: "Projects",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/ops/archives",
    label: "Project archives",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/ops/commercial",
    label: "Commercial",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/ops/check-ins",
    label: "Check-in requests",
    badgeKey: "checkIns",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M18 3v2.25M5.25 9h13.5M4.5 21h15a2.25 2.25 0 002.25-2.25V7.5A2.25 2.25 0 0019.5 5.25h-15a2.25 2.25 0 00-2.25 2.25v11.25A2.25 2.25 0 004.5 21z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/ops/analytics",
    label: "Analytics",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
];

const ATHLETE_PORTAL_NAV: NavItem[] = [
  {
    href: "/dashboard/athlete",
    label: "My dashboard",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/athlete/submissions",
    label: "Daily log",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/athlete/projects",
    label: "My projects",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/athlete/projects/completed",
    label: "Completed projects",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/athlete/notifications",
    label: "My notifications",
    badgeKey: "notifications",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0" />
      </svg>
    ),
  },
  {
    href: "/dashboard/athlete/book-call",
    label: "Book a call",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M18 3v2.25M5.25 9h13.5M4.5 21h15a2.25 2.25 0 002.25-2.25V7.5A2.25 2.25 0 0019.5 5.25h-15a2.25 2.25 0 00-2.25 2.25v11.25A2.25 2.25 0 004.5 21z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/planner?area=team&athlete=me",
    label: "Project planner",
    badgeKey: "inbox",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.096-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.58 2.58 0 00-.1-.664M6.75 7.5V9h6V7.5m-6 3h6v3.75H6.75V10.5z" />
      </svg>
    ),
  },
];

const ADMIN_NAV: NavItem[] = [
  {
    href: "/dashboard/admin",
    label: "Users & access",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
        />
      </svg>
    ),
  },
];

const NAV_SECTIONS: NavSection[] = [
  { id: "marketing", label: "Marketing", module: "marketing", items: MARKETING_NAV },
  { id: "admin", label: "Users & access", module: "admin", items: ADMIN_NAV },
];

function navActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/dashboard/ops") return pathname === "/dashboard/ops";
  if (href === "/dashboard/athlete") return pathname === "/dashboard/athlete";
  if (href.startsWith("/dashboard/planner")) return pathname.startsWith("/dashboard/planner");
  return pathname === href || pathname.startsWith(`${href}/`);
}

function DragHandle({ label }: { label: string }) {
  return (
    <span
      draggable
      aria-label={`Reorder ${label}`}
      title="Drag to reorder"
      className="flex h-8 w-5 shrink-0 cursor-grab items-center justify-center rounded text-slate-600 active:cursor-grabbing hover:bg-white/[0.06] hover:text-slate-400"
      onClick={(e) => e.preventDefault()}
    >
      <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
        <circle cx="5" cy="4" r="1.25" />
        <circle cx="11" cy="4" r="1.25" />
        <circle cx="5" cy="8" r="1.25" />
        <circle cx="11" cy="8" r="1.25" />
        <circle cx="5" cy="12" r="1.25" />
        <circle cx="11" cy="12" r="1.25" />
      </svg>
    </span>
  );
}

function NavLink({
  href,
  label,
  icon,
  pathname,
  badge,
  urgent,
  onNavigate,
}: NavItem & { pathname: string; badge?: number; urgent?: boolean; onNavigate?: () => void }) {
  const active = navActive(pathname, href);
  const showUrgent = urgent && !active && (badge ?? 0) > 0;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex min-w-0 flex-1 items-center gap-3 rounded-lg py-2.5 pr-3 text-sm font-medium transition-colors ${
        active
          ? "bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/25"
          : showUrgent
            ? "bg-red-500/10 text-red-200 ring-1 ring-red-500/35 hover:bg-red-500/15"
            : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
      } ${showUrgent ? "animate-pulse" : ""}`}
    >
      <span className={active ? "text-brand-400" : showUrgent ? "text-red-400" : "text-slate-500"}>
        {icon}
      </span>
      <span className="truncate">{label}</span>
      {(badge ?? 0) > 0 ? (
        <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
          {badge! > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

type DragItemState = { sectionId: string; index: number } | null;
type DragSectionState = { index: number } | null;

function DraggableNavItem({
  item,
  sectionId,
  index,
  pathname,
  dragging,
  dropIndex,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  badge,
  urgent,
  onNavigate,
}: {
  item: NavItem;
  sectionId: string;
  index: number;
  pathname: string;
  badge?: number;
  urgent?: boolean;
  dragging: DragItemState;
  dropIndex: number | null;
  onDragStart: (sectionId: string, index: number) => void;
  onDragOver: (sectionId: string, index: number) => void;
  onDrop: (sectionId: string, index: number) => void;
  onDragEnd: () => void;
  onNavigate?: () => void;
}) {
  const isDragging =
    dragging?.sectionId === sectionId && dragging.index === index;
  const showDropBefore =
    dropIndex === index &&
    dragging !== null &&
    (dragging.sectionId !== sectionId || dragging.index !== index);

  return (
    <div
      className={`relative flex items-center gap-0.5 ${isDragging ? "opacity-40" : ""}`}
      onDragOver={(e) => {
        if (!dragging || dragging.sectionId !== sectionId) return;
        e.preventDefault();
        onDragOver(sectionId, index);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(sectionId, index);
      }}
    >
      {showDropBefore ? (
        <span className="pointer-events-none absolute -top-0.5 left-1 right-1 h-0.5 rounded-full bg-brand-400/80" />
      ) : null}
      <span
        draggable
        className="hidden lg:inline"
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("application/x-sidebar-item", `${sectionId}:${index}`);
          onDragStart(sectionId, index);
        }}
        onDragEnd={onDragEnd}
      >
        <DragHandle label={item.label} />
      </span>
      <NavLink {...item} pathname={pathname} badge={badge} urgent={urgent} onNavigate={onNavigate} />
    </div>
  );
}

function SectionChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function DraggableSectionHeader({
  sectionId,
  label,
  index,
  isFirst,
  collapsed,
  dragging,
  dropIndex,
  onToggleCollapse,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  sectionId: string;
  label: string;
  index: number;
  isFirst: boolean;
  collapsed: boolean;
  dragging: DragSectionState;
  dropIndex: number | null;
  onToggleCollapse: (sectionId: string) => void;
  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDrop: (index: number) => void;
  onDragEnd: () => void;
}) {
  const isDragging = dragging?.index === index;
  const showDropBefore =
    dropIndex === index && dragging !== null && dragging.index !== index;
  const expanded = !collapsed;

  return (
    <div
      className={`relative ${isFirst ? "pt-1" : "pt-4"} ${isDragging ? "opacity-40" : ""}`}
      onDragOver={(e) => {
        if (!dragging) return;
        e.preventDefault();
        onDragOver(index);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(index);
      }}
    >
      {showDropBefore ? (
        <span className="pointer-events-none absolute top-2 left-1 right-1 h-0.5 rounded-full bg-brand-400/80" />
      ) : null}
      <div className="flex items-center gap-0.5">
        <span
          draggable
          className="hidden lg:inline"
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("application/x-sidebar-section", String(index));
            onDragStart(index);
          }}
          onDragEnd={onDragEnd}
        >
          <DragHandle label={`${label} section`} />
        </span>
        <button
          type="button"
          id={`sidebar-section-${sectionId}`}
          aria-expanded={expanded}
          aria-controls={`sidebar-section-items-${sectionId}`}
          onClick={() => onToggleCollapse(sectionId)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-bold uppercase tracking-wide text-slate-300 transition-colors hover:bg-white/[0.05] hover:text-slate-100"
        >
          <SectionChevron expanded={expanded} />
          <span className="truncate">{label}</span>
        </button>
      </div>
    </div>
  );
}

type SidebarBadges = Record<string, number>;

export function DashboardSidebar({
  user,
  mobileOpen = false,
  onNavigate,
}: {
  user: SessionUser;
  mobileOpen?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname() || "";
  const [navOrder, setNavOrder] = useState<SidebarNavOrder | null>(null);
  const [badges, setBadges] = useState<SidebarBadges>({});
  const [sidebarUrgent, setSidebarUrgent] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const skipSaveRef = useRef(true);
  const [dragItem, setDragItem] = useState<DragItemState>(null);
  const [dropItemIndex, setDropItemIndex] = useState<number | null>(null);
  const [dragSection, setDragSection] = useState<DragSectionState>(null);
  const [dropSectionIndex, setDropSectionIndex] = useState<number | null>(null);

  useEffect(() => {
    const saved = loadSidebarNavOrder(user.id);
    setNavOrder(saved);
    skipSaveRef.current = saved !== null;
    setHydrated(true);
  }, [user.id]);

  useEffect(() => {
    let cancelled = false;
    async function loadBadges() {
      const urls: string[] = [];
      if (canAccessModule(user.role, "ops")) urls.push("/api/ops/sidebar-badges");
      if (canAccessModule(user.role, "athlete_portal")) urls.push("/api/athlete/sidebar-badges");
      if (!urls.length) return;
      const results = await Promise.all(urls.map((u) => fetch(u).then((r) => (r.ok ? r.json() : null))));
      if (cancelled) return;
      const next: SidebarBadges = {};
      let urgent = false;
      for (const j of results) {
        if (!j) continue;
        if (j.notifications) next.notifications = (next.notifications ?? 0) + j.notifications;
        if (j.checkIns) next.checkIns = (next.checkIns ?? 0) + j.checkIns;
        if (j.submissionCheckIns) next.submissionCheckIns = (next.submissionCheckIns ?? 0) + j.submissionCheckIns;
        if (j.inbox) next.inbox = (next.inbox ?? 0) + j.inbox;
        if (j.urgent) urgent = true;
      }
      setBadges(next);
      setSidebarUrgent(urgent);
    }
    void loadBadges();
    const t = setInterval(() => void loadBadges(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [user.role]);

  useEffect(() => {
    if (!hydrated || !navOrder) return;
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    saveSidebarNavOrder(user.id, navOrder);
  }, [navOrder, hydrated, user.id]);

  const collapsedSectionIds = useMemo(
    () => new Set(navOrder?.collapsedSections ?? []),
    [navOrder?.collapsedSections]
  );

  const visibleSections = useMemo(() => {
    const filtered = NAV_SECTIONS.filter((section) => {
      if (section.id === "onboarding" || section.id === "ops") {
        if (section.id === "ops") return canAccessOpsOverview(user.role);
        return canAccessModule(user.role, section.module);
      }
      if (!canAccessModule(user.role, section.module)) return false;
      if (section.id === "planner" && user.role === "user") return false;
      return true;
    });
    const ordered = applySectionOrder(filtered, navOrder?.sections);
    return ordered.map((section) => {
      const items =
        section.id === "ops" && user.role === "manager"
          ? section.items.filter((item) => item.href === "/dashboard/ops")
          : section.items;
      return {
        ...section,
        items: applyItemOrder(items, navOrder?.items[section.id]),
      };
    });
  }, [user.role, navOrder]);

  const persistSectionOrder = (ids: string[]) => {
    setNavOrder((prev) => ({
      sections: ids,
      items: prev?.items ?? {},
      collapsedSections: prev?.collapsedSections,
    }));
  };

  const persistItemOrder = (sectionId: string, hrefs: string[]) => {
    setNavOrder((prev) => ({
      sections: prev?.sections ?? visibleSections.map((s) => s.id),
      items: { ...(prev?.items ?? {}), [sectionId]: hrefs },
      collapsedSections: prev?.collapsedSections,
    }));
  };

  const toggleSectionCollapse = (sectionId: string) => {
    skipSaveRef.current = false;
    setNavOrder((prev) => {
      const collapsed = new Set(prev?.collapsedSections ?? []);
      if (collapsed.has(sectionId)) collapsed.delete(sectionId);
      else collapsed.add(sectionId);
      return {
        sections: prev?.sections ?? visibleSections.map((s) => s.id),
        items: prev?.items ?? {},
        collapsedSections: Array.from(collapsed),
      };
    });
  };

  const handleItemDrop = (sectionId: string, toIndex: number) => {
    if (!dragItem || dragItem.sectionId !== sectionId) {
      setDragItem(null);
      setDropItemIndex(null);
      return;
    }
    const section = visibleSections.find((s) => s.id === sectionId);
    if (!section) return;
    const hrefs = section.items.map((i) => i.href);
    const next = reorderIds(hrefs, dragItem.index, toIndex);
    persistItemOrder(sectionId, next);
    setDragItem(null);
    setDropItemIndex(null);
  };

  const handleSectionDrop = (toIndex: number) => {
    if (!dragSection) {
      setDragSection(null);
      setDropSectionIndex(null);
      return;
    }
    const ids = visibleSections.map((s) => s.id);
    const next = reorderIds(ids, dragSection.index, toIndex);
    persistSectionOrder(next);
    setDragSection(null);
    setDropSectionIndex(null);
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-[min(85vw,280px)] flex-col border-r border-white/[0.06] bg-[var(--bg-sidebar)] transition-transform duration-200 ease-out lg:relative lg:z-auto lg:w-[260px] lg:min-h-screen lg:flex-shrink-0 lg:translate-x-0 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      }`}
    >
      <div className="border-b border-white/[0.06] px-4 py-5">
        <BrandMark />
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Dimension Group — marketing leads, outreach, and notifications.
        </p>
        <a
          href={BLOCHARCH_SITE}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-brand-400/90 hover:text-brand-300"
        >
          dimensiongroupglobal.com
          <span aria-hidden className="text-[10px] opacity-70">
            ↗
          </span>
        </a>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto overscroll-y-contain p-3" aria-label="Main">
        <p className="hidden px-1 pb-2 text-[10px] text-slate-600 lg:block">
          Drag <span className="text-slate-500">⋮⋮</span> to reorder sections and links. Saved for your account on this device.
        </p>
        {visibleSections.map((section, sectionIndex) => {
          const sectionCollapsed = collapsedSectionIds.has(section.id);
          return (
          <div key={section.id} className="space-y-0.5">
            <DraggableSectionHeader
              sectionId={section.id}
              label={section.label}
              index={sectionIndex}
              isFirst={sectionIndex === 0}
              collapsed={sectionCollapsed}
              dragging={dragSection}
              dropIndex={dropSectionIndex}
              onToggleCollapse={toggleSectionCollapse}
              onDragStart={(index) => {
                setDragSection({ index });
                setDragItem(null);
              }}
              onDragOver={setDropSectionIndex}
              onDrop={handleSectionDrop}
              onDragEnd={() => {
                setDragSection(null);
                setDropSectionIndex(null);
              }}
            />
            {!sectionCollapsed ? (
            <div id={`sidebar-section-items-${section.id}`} className="space-y-0.5 pb-1">
              {section.items.map((item, itemIndex) => (
                <DraggableNavItem
                  key={item.href}
                  item={item}
                  sectionId={section.id}
                  index={itemIndex}
                  pathname={pathname}
                  badge={item.badgeKey ? badges[item.badgeKey] : undefined}
                  urgent={
                    item.badgeKey === "inbox"
                      ? (badges.inbox ?? 0) > 0
                      : item.badgeKey === "checkIns"
                        ? (badges.checkIns ?? 0) > 0
                        : item.badgeKey === "notifications"
                          ? sidebarUrgent
                          : false
                  }
                  dragging={dragItem}
                  dropIndex={dropItemIndex}
                  onDragStart={(sid, idx) => {
                    setDragItem({ sectionId: sid, index: idx });
                    setDragSection(null);
                  }}
                  onDragOver={(sid, idx) => {
                    if (dragItem?.sectionId === sid) setDropItemIndex(idx);
                  }}
                  onDrop={handleItemDrop}
                  onDragEnd={() => {
                    setDragItem(null);
                    setDropItemIndex(null);
                  }}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
            ) : null}
          </div>
          );
        })}
      </nav>
      <div className="border-t border-white/[0.06] px-3 py-3">
        <ThemeToggle />
      </div>
      <div className="border-t border-white/[0.06] p-4">
        <div className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/[0.06]">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Signed in</p>
            <p className="truncate text-xs text-slate-400" title={user.username}>
              {user.username}
              {user.role === "admin" ? (
                <span className="ml-1.5 rounded bg-brand-500/15 px-1 py-0.5 text-[9px] font-semibold uppercase text-brand-400">
                  admin
                </span>
              ) : user.role === "manager" ? (
                <span className="ml-1.5 rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-semibold uppercase text-amber-400">
                  manager
                </span>
              ) : user.role === "user" ? (
                <span className="ml-1.5 rounded bg-slate-500/15 px-1 py-0.5 text-[9px] font-semibold uppercase text-slate-400">
                  athlete
                </span>
              ) : null}
            </p>
          </div>
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}
