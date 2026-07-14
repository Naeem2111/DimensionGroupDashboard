"use client";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import L from "leaflet";
import "leaflet.markercluster";
import { MapContainer, TileLayer, useMap, Circle } from "react-leaflet";
import { useEffect, useMemo, useRef } from "react";

type Stage = LeadStage;

type MarkerItem = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  stage: Stage;
  subtitle?: string;
  href?: string;
  /** First client / Blocharch hub (e.g. Icon Architects at Plato Place). */
  hub?: boolean;
  /** Extra line under hub banner (studio address). */
  hubDetail?: string;
};

import { LEAD_STAGE_COLORS } from "@/lib/lead-stage-ui";
import type { LeadStage } from "@/lib/leads";
import { buildMapPinStageSelectHtml, initMapPinStageDropdown } from "@/lib/map-pin-popup";

const STAGE_COLORS: Record<Stage, string> = LEAD_STAGE_COLORS;

const iconCache = new Map<string, L.DivIcon>();

function markerIcon(stage: Stage, hub: boolean): L.DivIcon {
  const key = `${stage}:${hub ? "hub-lg" : "std"}`;
  const cached = iconCache.get(key);
  if (cached) return cached;
  const hubClass = hub ? " lead-stage-pin--hub" : "";
  const size = hub ? 36 : 16;
  const anchor = hub ? 18 : 8;
  const icon = L.divIcon({
    className: "lead-stage-pin-wrap",
    html: `<span class="lead-stage-pin${hubClass}" style="--pin-color:${STAGE_COLORS[stage]}"></span>`,
    iconSize: [size, size],
    iconAnchor: [anchor, anchor],
  });
  iconCache.set(key, icon);
  return icon;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function markerSignature(markers: MarkerItem[]): string {
  return markers
    .map(
      (m) =>
        `${m.id}\t${m.lat}\t${m.lng}\t${m.stage}\t${m.hub ? "hub-lg" : "std"}\t${m.hubDetail ?? ""}`
    )
    .join("\n");
}

function HubRadiusLayer({ markers }: { markers: MarkerItem[] }) {
  const hub = useMemo(() => markers.find((m) => m.hub && m.hubDetail), [markers]);
  if (!hub) return null;
  return (
    <Circle
      center={[hub.lat, hub.lng]}
      radius={14000}
      pathOptions={{
        color: "#f59e0b",
        fillColor: "#fbbf24",
        fillOpacity: 0.06,
        weight: 1,
        opacity: 0.4,
      }}
    />
  );
}

function MapViewController({
  center,
  zoom,
}: {
  center: [number, number];
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: false });
  }, [map, center[0], center[1], zoom]);
  return null;
}

/** Animated snap back to focal hub when `tick` increases (initial tick 0 is ignored). */
function HubRecenterController({
  tick,
  mapCenter,
  zoom,
}: {
  tick: number;
  mapCenter: [number, number];
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (tick <= 0) return;
    map.setView(mapCenter, zoom, { animate: true });
  }, [tick, map, zoom, mapCenter[0], mapCenter[1]]);
  return null;
}

function MapClusterLayer({
  markers,
  onStageChange,
}: {
  markers: MarkerItem[];
  onStageChange?: (slug: string, stage: Stage) => void;
}) {
  const map = useMap();
  const sig = useMemo(() => markerSignature(markers), [markers]);
  const onStageChangeRef = useRef(onStageChange);
  onStageChangeRef.current = onStageChange;

  useEffect(() => {
    if (!markers.length) return;

    const mcg = L.markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 120,
      maxClusterRadius: 40,
      disableClusteringAtZoom: 13,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
    });

    for (const m of markers) {
      const marker = L.marker([m.lat, m.lng], { icon: markerIcon(m.stage, Boolean(m.hub)) });
      const lines = [
        `<div class="font-semibold">${escapeHtml(m.name)}</div>`,
        m.hub && m.hubDetail
          ? `<div class="text-xs font-medium text-amber-700">${escapeHtml(m.hubDetail)}</div>`
          : m.hub
            ? `<div class="text-xs font-medium text-amber-700">Blocharch hub practice</div>`
            : "",
        m.subtitle ? `<div class="text-sm opacity-80">${escapeHtml(m.subtitle)}</div>` : "",
        m.href
          ? /^https?:\/\//i.test(m.href)
            ? `<a class="text-sm text-sky-600 underline" href="${escapeHtml(m.href)}" target="_blank" rel="noopener noreferrer">Website</a>`
            : `<a class="text-sm text-sky-600 underline" href="${escapeHtml(m.href)}">View practice</a>`
          : "",
        !m.hub && onStageChangeRef.current
          ? buildMapPinStageSelectHtml(m.id, m.stage)
          : "",
      ].filter(Boolean);
      marker.bindPopup(lines.join(""));
      if (!m.hub && onStageChangeRef.current) {
        let cleanupPicker: (() => void) | null = null;
        marker.on("popupopen", () => {
          cleanupPicker?.();
          const popupEl = marker.getPopup()?.getElement();
          const picker = popupEl?.querySelector(".map-pin-stage-picker") as HTMLElement | null;
          if (!picker) return;
          cleanupPicker = initMapPinStageDropdown(picker, (stage) => {
            onStageChangeRef.current?.(m.id, stage);
          });
        });
        marker.on("popupclose", () => {
          cleanupPicker?.();
          cleanupPicker = null;
        });
      }
      mcg.addLayer(marker);
    }

    map.addLayer(mcg);
    return () => {
      map.removeLayer(mcg);
      mcg.clearLayers();
    };
  }, [map, sig]);

  return null;
}

export function LeafletMap({
  markers,
  center,
  zoom = 6,
  heightClassName = "h-[min(420px,55vh)] sm:h-[520px]",
  hubRecenterTick = 0,
  onStageChange,
}: {
  markers: MarkerItem[];
  center: { lat: number; lng: number };
  zoom?: number;
  heightClassName?: string;
  /** Bump (e.g. `setTick((n) => n + 1)`) to animate the map back to `center` / `zoom` (hub focal pin). */
  hubRecenterTick?: number;
  /** Called when a pin popup stage dropdown changes (slug = practice slug). */
  onStageChange?: (slug: string, stage: Stage) => void;
}) {
  const mapCenter = useMemo(() => [center.lat, center.lng] as [number, number], [center.lat, center.lng]);

  return (
    <div
      className={`leaflet-map-cluster-blue overflow-hidden rounded-2xl border border-white/[0.1] ring-1 ring-white/[0.06] ${heightClassName}`}
    >
      <MapContainer center={mapCenter} zoom={zoom} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
        />
        <MapViewController center={mapCenter} zoom={zoom} />
        <HubRecenterController tick={hubRecenterTick} mapCenter={mapCenter} zoom={zoom} />
        {markers.some((m) => m.hub && m.hubDetail) ? <HubRadiusLayer markers={markers} /> : null}
        {markers.length > 0 ? (
          <MapClusterLayer markers={markers} onStageChange={onStageChange} />
        ) : null}
      </MapContainer>
      <style jsx>{`
        :global(.lead-stage-pin-wrap) {
          background: transparent;
          border: none;
        }
        :global(.lead-stage-pin) {
          display: block;
          width: 16px;
          height: 16px;
          border-radius: 9999px;
          background: var(--pin-color);
          border: 2px solid #ffffff;
          box-shadow: 0 0 0 1px rgba(2, 6, 23, 0.35);
        }
        :global(.leaflet-map-cluster-blue .lead-stage-pin--hub) {
          width: 36px;
          height: 36px;
          border-width: 4px;
          box-shadow:
            0 0 0 5px rgba(245, 158, 11, 0.45),
            0 0 28px 12px rgba(245, 158, 11, 0.28),
            0 0 0 1px rgba(2, 6, 23, 0.35);
        }
        /** Unify MarkerCluster tiers (small/medium/large) — default CSS is green / yellow / orange. */
        :global(.leaflet-map-cluster-blue .marker-cluster-small),
        :global(.leaflet-map-cluster-blue .marker-cluster-medium),
        :global(.leaflet-map-cluster-blue .marker-cluster-large) {
          background-color: rgba(56, 189, 248, 0.32);
        }
        :global(.leaflet-map-cluster-blue .marker-cluster-small div),
        :global(.leaflet-map-cluster-blue .marker-cluster-medium div),
        :global(.leaflet-map-cluster-blue .marker-cluster-large div) {
          background-color: rgba(14, 165, 233, 0.85);
          color: rgb(248, 250, 252);
        }
        :global(.leaflet-map-cluster-blue .leaflet-popup-content) {
          overflow: visible;
        }
        :global(.map-pin-stage-row) {
          margin-top: 8px;
        }
        :global(.map-pin-stage-label) {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: #475569;
          margin-bottom: 4px;
        }
        :global(.map-pin-stage-picker) {
          position: relative;
          width: 100%;
        }
        :global(.map-pin-stage-trigger) {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 4px 8px;
          background: #fff;
          color: #0f172a;
          text-align: left;
          cursor: pointer;
        }
        :global(.map-pin-stage-trigger-label) {
          flex: 1;
          min-width: 0;
        }
        :global(.map-pin-stage-chevron) {
          color: #64748b;
          font-size: 10px;
          line-height: 1;
        }
        :global(.map-pin-stage-menu) {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          z-index: 1000;
          margin: 0;
          padding: 4px;
          list-style: none;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background: #fff;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.12);
          max-height: 220px;
          overflow-y: auto;
        }
        :global(.map-pin-stage-option) {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          border: none;
          border-radius: 4px;
          padding: 6px 8px;
          background: transparent;
          color: #0f172a;
          font-size: 12px;
          text-align: left;
          cursor: pointer;
        }
        :global(.map-pin-stage-option:hover) {
          background: #f1f5f9;
        }
        :global(.map-pin-stage-option--selected) {
          background: #eff6ff;
        }
        :global(.map-pin-stage-option-label) {
          flex: 1;
          min-width: 0;
        }
      `}</style>
    </div>
  );
}
