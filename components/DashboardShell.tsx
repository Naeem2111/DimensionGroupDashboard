"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import type { SessionUser } from "@/lib/auth";

export function DashboardShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <div className="flex min-h-screen min-w-0">
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] lg:hidden"
          onClick={closeMobile}
        />
      ) : null}

      <DashboardSidebar
        user={user}
        mobileOpen={mobileOpen}
        onNavigate={closeMobile}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/[0.06] bg-[var(--bg-main)]/95 px-4 py-3 backdrop-blur-md lg:hidden">
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((o) => !o)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              {mobileOpen ? (
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              ) : (
                <>
                  <path strokeLinecap="round" d="M4 7h16" />
                  <path strokeLinecap="round" d="M4 12h16" />
                  <path strokeLinecap="round" d="M4 17h16" />
                </>
              )}
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">Blocharch Console</p>
            <p className="truncate text-[11px] text-slate-500">{user.username}</p>
          </div>
        </header>

        <main className="app-main min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
