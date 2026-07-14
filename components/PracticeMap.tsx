"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

const LeafletMap = dynamic(async () => (await import("@/components/LeafletMap")).LeafletMap, {
  ssr: false,
  loading: () => (
    <div className="card-tool flex h-[320px] items-center justify-center rounded-2xl ring-1 ring-white/[0.06]">
      <p className="text-slate-400 text-sm">Loading map…</p>
    </div>
  ),
});

export function PracticeMap({
  name,
  address,
  href,
  heightClassName = "h-[320px]",
}: {
  name: string;
  address: string;
  href?: string;
  heightClassName?: string;
}) {
  const [point, setPoint] = useState<{ lat: number; lng: number; displayName?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setError(null);
        const res = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
        if (!res.ok) {
          if (!cancelled) setError("No location found for this address.");
          return;
        }
        const json = await res.json();
        if (!cancelled) setPoint({ lat: json.lat, lng: json.lng, displayName: json.displayName });
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    }
    if (address?.trim()) run();
    return () => {
      cancelled = true;
    };
  }, [address]);

  const markers = useMemo(() => {
    if (!point) return [];
    return [
      {
        id: "practice",
        name,
        lat: point.lat,
        lng: point.lng,
        stage: "cold" as const,
        subtitle: point.displayName || address,
        href,
      },
    ];
  }, [address, href, name, point]);

  if (!address?.trim()) return null;

  return (
    <div className="space-y-2">
      <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Map</p>
      {error && <p className="text-slate-400 text-sm">{error}</p>}
      {point && (
        <LeafletMap
          markers={markers}
          center={{ lat: point.lat, lng: point.lng }}
          zoom={12}
          heightClassName={heightClassName}
        />
      )}
    </div>
  );
}

