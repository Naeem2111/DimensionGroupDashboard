import type { Metadata } from "next";
import { cookies } from "next/headers";
import { brandAssets } from "@/lib/blocharch-brand";
import { DEFAULT_THEME, THEME_COOKIE, normalizeTheme } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Project tracker — Blocharch",
  description: "Live view of your active projects and open tasks.",
  icons: {
    icon: [{ url: brandAssets.favicon, type: "image/png" }],
  },
};

export default async function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const theme = normalizeTheme(cookieStore.get(THEME_COOKIE)?.value ?? DEFAULT_THEME);

  return (
    <div className="client-portal-shell min-h-screen bg-[var(--bg-page)] text-slate-100" data-portal-theme={theme}>
      {children}
    </div>
  );
}
