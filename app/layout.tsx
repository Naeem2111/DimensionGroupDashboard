import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { brandAssets } from "@/lib/brand";
import { cookies } from "next/headers";
import { DEFAULT_THEME, THEME_COOKIE, normalizeTheme } from "@/lib/theme";
import "./globals.css";
import "leaflet/dist/leaflet.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Dimension Group Console",
  description: "Leads, map, and marketing tools — Dimension Group internal console.",
  icons: {
    icon: [
      { url: brandAssets.favicon, type: "image/png", sizes: "100x100" },
      { url: brandAssets.favicon, type: "image/png", sizes: "32x32" },
    ],
    apple: brandAssets.favicon,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const theme = normalizeTheme(cookieStore.get(THEME_COOKIE)?.value ?? DEFAULT_THEME);

  return (
    <html lang="en" className={sans.variable} data-theme={theme} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(dark|light)/);document.documentElement.dataset.theme=m?m[1]:${JSON.stringify(theme)};}catch(e){document.documentElement.dataset.theme=${JSON.stringify(DEFAULT_THEME)};}})();`,
          }}
        />
      </head>
      <body className="font-sans min-h-screen antialiased">{children}</body>
    </html>
  );
}
