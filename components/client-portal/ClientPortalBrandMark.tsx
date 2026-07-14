"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { brandAssets } from "@/lib/blocharch-brand";
import {
  DEFAULT_THEME,
  type ThemePreference,
  isThemePreference,
  normalizeTheme,
} from "@/lib/theme";

function readThemeFromDom(): ThemePreference {
  if (typeof document === "undefined") return DEFAULT_THEME;
  return normalizeTheme(document.documentElement.dataset.theme);
}

/** Blocharch logo for the public client portal (no Console label). */
export function ClientPortalBrandMark({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<ThemePreference>(DEFAULT_THEME);

  useEffect(() => {
    setTheme(readThemeFromDom());

    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("blocarch-theme");
    channel.onmessage = (event: MessageEvent<{ theme?: unknown }>) => {
      if (!isThemePreference(event.data?.theme)) return;
      setTheme(event.data.theme);
    };
    return () => channel.close();
  }, []);

  const logoSrc = theme === "dark" ? brandAssets.clientLogoDark : brandAssets.clientLogo;

  return (
    <Link
      href="https://www.blocharch.com/"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 ${className}`}
    >
      <Image
        src={logoSrc}
        alt="Blocharch"
        width={200}
        height={64}
        priority
        className="h-14 w-auto object-contain object-left sm:h-16"
      />
    </Link>
  );
}
