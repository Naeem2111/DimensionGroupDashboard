"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MAP_PRACTICE_DISPLAY_LIMIT, type MapPracticeStage } from "@/lib/map-practices";
import { LEAD_STAGES } from "@/lib/leads";
import { LEAD_STAGE_COLORS, LEAD_STAGE_LABELS } from "@/lib/lead-stage-ui";

import { hubUsesIconStudio, type MapHubAnchor } from "@/lib/map-hub";

const MAP_ICON = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 6.75V15m6-6v8.25m.106-18.256c.746.393 1.196 1.192 1.196 2.042v15.638a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184m7.5 0v-.462c0-.41-.34-.75-.75-.75h-4.5c-.41 0-.75.34-.75.75v.462m4.5 0v.462c0 .41-.34.75-.75.75h-4.5a.75.75 0 01-.75-.75v-.462m4.5 0h-4.5"
    />
  </svg>
);

const LeafletMap = dynamic(async () => (await import("@/components/LeafletMap")).LeafletMap, {
  ssr: false,
  loading: () => (
    <div className="card-tool flex h-[520px] items-center justify-center rounded-2xl ring-1 ring-white/[0.06]">
      <p className="text-slate-400 text-sm">Loading map…</p>
    </div>
  ),
});

type Practice = { name: string; address: string; slug: string; stage: MapPracticeStage };

const MAP_FOCAL_SYNTHETIC_ID = "__blocharch_map_focal__";

const STAGE_META: Record<MapPracticeStage, { label: string; color: string }> = Object.fromEntries(
  LEAD_STAGES.map((stage) => [
    stage,
    { label: LEAD_STAGE_LABELS[stage], color: LEAD_STAGE_COLORS[stage] },
  ])
) as Record<MapPracticeStage, { label: string; color: string }>;

/** Per-request batch size for Nominatim (uncached addresses only). Order follows proximity-sorted practices. */
const GEOCODE_CHUNK = 8;

type GeocodeEntry = { lat: number; lng: number; displayName?: string };

export function MapClient({
  practices,
  initialGeocodes,
  focalAnchor,
}: {
  practices: Practice[];
  initialGeocodes: Record<string, GeocodeEntry>;
  focalAnchor: MapHubAnchor;
}) {
  const [results, setResults] = useState<Record<string, GeocodeEntry>>(() => ({ ...initialGeocodes }));
  const [loading, setLoading] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [chunksDone, setChunksDone] = useState(0);
  const [chunksTotal, setChunksTotal] = useState(0);

  const [pinSearchInput, setPinSearchInput] = useState("");
  const [pinFilter, setPinFilter] = useState("");
  const [stageBySlug, setStageBySlug] = useState<Record<string, MapPracticeStage>>({});
  const [stageError, setStageError] = useState<string | null>(null);
  /** Increment to tell LeafletMap to fly back to the focal hub coordinates. */
  const [hubRecenterTick, setHubRecenterTick] = useState(0);

  const initialKey = useMemo(() => Object.keys(initialGeocodes).sort().join("|"), [initialGeocodes]);
  const initialGeoRef = useRef(initialGeocodes);
  initialGeoRef.current = initialGeocodes;

  const practiceKey = useMemo(
    () => practices.map((p) => `${p.slug}\t${p.address}`).join("\n"),
    [practices]
  );

  useEffect(() => {
    setResults({ ...initialGeocodes });
  }, [initialGeocodes, initialKey]);

  useEffect(() => {
    setStageBySlug((prev) => {
      const next = { ...prev };
      for (const p of practices) {
        if (!(p.slug in next)) next[p.slug] = p.stage;
      }
      return next;
    });
  }, [practiceKey, practices]);

  const updateStage = useCallback(
    async (slug: string, stage: MapPracticeStage) => {
      setStageError(null);
      let previous: MapPracticeStage = "cold";
      setStageBySlug((prev) => {
        previous = prev[slug] ?? practices.find((p) => p.slug === slug)?.stage ?? "cold";
        return { ...prev, [slug]: stage };
      });
      try {
        const res = await fetch(`/api/leads/${encodeURIComponent(slug)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error((j as { error?: string }).error || "Could not save stage");
        }
      } catch (e) {
        setStageBySlug((prev) => ({ ...prev, [slug]: previous }));
        setStageError(e instanceof Error ? e.message : "Could not save stage");
      }
    },
    [practices]
  );

  useEffect(() => {
    let cancelled = false;
    const prefilled = new Set(Object.keys(initialGeoRef.current));
    const missing = practices
      .map((p) => p.address)
      .filter((addr) => addr && !prefilled.has(addr));

    const uniqueMissing = Array.from(new Set(missing));
    const chunks: string[][] = [];
    for (let i = 0; i < uniqueMissing.length; i += GEOCODE_CHUNK) {
      chunks.push(uniqueMissing.slice(i, i + GEOCODE_CHUNK));
    }

    async function run() {
      if (!chunks.length) return;
      setGeocodeError(null);
      setLoading(true);
      setChunksTotal(chunks.length);
      setChunksDone(0);
      try {
        for (let i = 0; i < chunks.length; i++) {
          if (cancelled) break;
          const slice = chunks[i];
          const res = await fetch("/api/geocode/batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ addresses: slice, limit: slice.length, persist: true }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) {
            setGeocodeError(json?.error || `Geocode failed (${res.status})`);
            break;
          }
          if (json?.results && !cancelled) {
            setResults((prev) => {
              const next = { ...prev };
              for (const [addr, row] of Object.entries(json.results)) {
                next[addr] = {
                  lat: (row as GeocodeEntry).lat,
                  lng: (row as GeocodeEntry).lng,
                  displayName: (row as GeocodeEntry).displayName,
                };
              }
              return next;
            });
          }
          setChunksDone(i + 1);
        }
      } catch (e) {
        if (!cancelled) setGeocodeError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (uniqueMissing.length) run();
    else {
      setChunksTotal(0);
      setChunksDone(0);
    }

    return () => {
      cancelled = true;
    };
  }, [practiceKey, initialKey]);

  const markersBase = useMemo(() => {
    const out: Array<{
      id: string;
      name: string;
      lat: number;
      lng: number;
      stage: MapPracticeStage;
      subtitle?: string;
      href?: string;
      hub?: boolean;
      hubDetail?: string;
    }> = [];
    const hubSlug = focalAnchor.slug;
    for (const p of practices) {
      const r = results[p.address];
      const isHub = Boolean(hubSlug && p.slug === hubSlug);

      if (!r && !(isHub && focalAnchor)) continue;

      const lat = isHub && focalAnchor ? focalAnchor.lat : r!.lat;
      const lng = isHub && focalAnchor ? focalAnchor.lng : r!.lng;

      out.push({
        id: p.slug,
        name: p.name,
        lat,
        lng,
        stage: stageBySlug[p.slug] ?? p.stage,
        subtitle:
          isHub && focalAnchor
            ? undefined
            : r?.displayName || p.address,
        href: `/dashboard/practices/${encodeURIComponent(p.slug)}`,
        hub: isHub,
        hubDetail:
          isHub && focalAnchor && hubUsesIconStudio(focalAnchor)
            ? "5 Plato Place, 72–74 St Dionis Road, London SW6 4TU · Blocharch hub"
            : undefined,
      });
    }
    return out;
  }, [practices, results, focalAnchor, stageBySlug]);

  const markers = useMemo(() => {
    const list = [...markersBase];
    const needsSyntheticPin =
      hubUsesIconStudio(focalAnchor) && !markersBase.some((m) => m.hub);
    if (needsSyntheticPin) {
      list.unshift({
        id: MAP_FOCAL_SYNTHETIC_ID,
        name: focalAnchor.name,
        lat: focalAnchor.lat,
        lng: focalAnchor.lng,
        stage: "cold",
        hub: true,
        hubDetail: "5 Plato Place, 72–74 St Dionis Road, London SW6 4TU · Blocharch hub",
        href: "https://www.icon-architects.com/",
      });
    }
    return list;
  }, [markersBase, focalAnchor]);

  const filteredMarkers = useMemo(() => {
    const t = pinFilter.trim().toLowerCase();
    if (!t) return markers;
    return markers.filter((m) => {
      const nameOk = m.name.toLowerCase().includes(t);
      const subOk = (m.subtitle ?? "").toLowerCase().includes(t);
      const idOk =
        typeof m.id === "string"
          ? m.id.toLowerCase().includes(t.replace(/\s+/g, ""))
          : false;
      if (nameOk || subOk || idOk) return true;
      if (m.id === MAP_FOCAL_SYNTHETIC_ID) {
        const hubName = focalAnchor.name.toLowerCase();
        const hubSlug = focalAnchor.slug.toLowerCase();
        return hubName.includes(t) || hubSlug.includes(t.replace(/\s+/g, ""));
      }
      return false;
    });
  }, [markers, pinFilter, focalAnchor.name, focalAnchor.slug]);

  const initialZoom = hubUsesIconStudio(focalAnchor) ? 13 : 11;

  const center = useMemo(
    () => ({ lat: focalAnchor.lat, lng: focalAnchor.lng }),
    [focalAnchor.lat, focalAnchor.lng]
  );

  const stageCounts = useMemo(() => {
    const counts = Object.fromEntries(LEAD_STAGES.map((s) => [s, 0])) as Record<
      MapPracticeStage,
      number
    >;
    for (const m of filteredMarkers) {
      if (m.id === MAP_FOCAL_SYNTHETIC_ID) continue;
      counts[m.stage] += 1;
    }
    return counts;
  }, [filteredMarkers]);

  const practicesWithDbCoords = practices.filter((p) => initialGeocodes[p.address]).length;
  const pendingGeocode = practices.filter((p) => p.address && !results[p.address]).length;
  const geocodeProgress = chunksTotal > 0 ? ` — batch ${chunksDone}/${chunksTotal}` : "";

  let statusExtra = "";
  if (practicesWithDbCoords > 0 && pendingGeocode === 0) {
    statusExtra = ` All ${markers.filter((m) => m.id !== MAP_FOCAL_SYNTHETIC_ID).length} practice pins loaded from the database.`;
  } else if (practicesWithDbCoords > 0 && pendingGeocode > 0) {
    statusExtra = ` ${practicesWithDbCoords} from database; geocoding ${pendingGeocode} more (nearest-first queue)${loading ? `…${geocodeProgress}` : ""}.`;
  } else if (pendingGeocode > 0 && loading) {
    statusExtra = ` Geocoding…${geocodeProgress} (uses postcode fallbacks for approximate pins).`;
  } else if (pendingGeocode > 0) {
    statusExtra = ` ${pendingGeocode} without stored coordinates — pins placed by postcode when geocoded.`;
  }

  const pinCount = markers.filter((m) => m.id !== MAP_FOCAL_SYNTHETIC_ID).length;
  const visiblePinCount = filteredMarkers.filter((m) => m.id !== MAP_FOCAL_SYNTHETIC_ID).length;
  const hasActiveFilter = pinFilter.trim().length > 0;

  const applyPinFilter = () => {
    setPinFilter(pinSearchInput.trim());
  };

  const hubRecenterTitle = hubUsesIconStudio(focalAnchor)
    ? "Icon Architects hub (Plato Place)"
    : `${focalAnchor.name} focal pin`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <input
          type="search"
          value={pinSearchInput}
          onChange={(e) => setPinSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") applyPinFilter();
          }}
          placeholder="Search by practice name, address, or slug…"
          aria-label="Filter map pins"
          className="flex-1 min-w-0 rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder-slate-500 ring-1 ring-black/20 focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        />
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={applyPinFilter}
            className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 p-2.5 text-slate-950 shadow-lg shadow-brand/25 ring-1 ring-brand-400/40 transition-opacity hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/70"
            title="Apply search"
            aria-label="Apply map search filter"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setHubRecenterTick((n) => n + 1)}
            className="inline-flex items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.06] p-2.5 text-slate-300 ring-1 ring-white/[0.04] transition-colors hover:border-brand-500/35 hover:bg-brand-500/10 hover:text-brand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
            title={`Center map on ${hubRecenterTitle}`}
            aria-label={`Center map on ${hubRecenterTitle}`}
          >
            {MAP_ICON}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-slate-500 text-sm">
          {hasActiveFilter ? (
            <>
              Showing {visiblePinCount} match{visiblePinCount === 1 ? "" : "es"} ({pinCount} total mapped){' '}
            </>
          ) : (
            <>
              Showing {pinCount} mapped practice{pinCount === 1 ? "" : "s"}
            </>
          )}
          {' '}
          {MAP_PRACTICE_DISPLAY_LIMIT > 0 ? (
            <>
              — up to {MAP_PRACTICE_DISPLAY_LIMIT} loaded, ordered nearest-first to{" "}
              {hubUsesIconStudio(focalAnchor) ? "Icon Architects (Plato Place)" : focalAnchor.name}
              {practices.length < MAP_PRACTICE_DISPLAY_LIMIT
                ? ` (${practices.length} in directory with usable addresses).`
                : "."}
            </>
          ) : (
            <>
              — full directory loaded ({practices.length} practices), ordered nearest-first to{" "}
              {hubUsesIconStudio(focalAnchor) ? "Icon Architects (Plato Place)" : focalAnchor.name}.
              Pins without stored coordinates are geocoded in batches as you view the map.
            </>
          )}
          {statusExtra}
        </p>
        <p className="text-slate-500 text-sm">
          {hubUsesIconStudio(focalAnchor)
            ? "Zoomed on Plato Place (SW6); zoom out for regional / UK context."
            : `Framed on ${focalAnchor.name} — zoom out for wider coverage.`}
        </p>
      </div>
      {geocodeError && (
        <p className="text-amber-400/90 text-sm rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          {geocodeError}
        </p>
      )}
      {stageError && (
        <p className="text-red-400/90 text-sm rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
          {stageError}
        </p>
      )}
      {hasActiveFilter && filteredMarkers.length === 0 ? (
        <div className="card-tool flex h-[520px] flex-col items-center justify-center rounded-2xl ring-1 ring-white/[0.06] px-6 text-center">
          <p className="text-slate-400 text-sm">
            No practices match “{pinFilter.trim()}”. Clear or change the search to see pins.
          </p>
          <button
            type="button"
            className="mt-4 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/[0.09]"
            onClick={() => {
              setPinSearchInput("");
              setPinFilter("");
            }}
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="relative">
          {loading && pendingGeocode > 0 ? (
            <p className="absolute left-3 top-3 z-[1000] rounded-lg border border-white/10 bg-slate-950/90 px-3 py-2 text-xs text-slate-300 shadow-lg">
              Loading map pins… {chunksDone}/{chunksTotal} batches
              {pinCount > 0 ? ` (${pinCount} visible)` : ""}
            </p>
          ) : null}
          <LeafletMap
            markers={filteredMarkers}
            center={center}
            zoom={initialZoom}
            hubRecenterTick={hubRecenterTick}
            onStageChange={updateStage}
          />
        </div>
      )}
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
          Lead stage colours — click a pin to change stage
        </p>
        {hubUsesIconStudio(focalAnchor) ? (
          <p className="text-xs text-slate-500 mb-3">
            Large amber glow — Blocharch focal point: {focalAnchor.name} at 5 Plato Place, St Dionis Road, London SW6 4TU (
            <a
              href="https://www.icon-architects.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-400 hover:underline"
            >
              icon-architects.com
            </a>
            ). Listed practices are prioritised by proximity to this studio.
          </p>
        ) : (
          <p className="text-xs text-slate-500 mb-3">
            Hub pin — {focalAnchor.name}. Listed practices are prioritised by proximity to this focal point.
          </p>
        )}
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {(Object.keys(STAGE_META) as MapPracticeStage[]).map((stage) => (
            <div key={stage} className="flex items-center gap-2 text-xs text-slate-300">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: STAGE_META[stage].color }}
              />
              <span>{STAGE_META[stage].label}</span>
              <span className="text-slate-500">({stageCounts[stage]})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
