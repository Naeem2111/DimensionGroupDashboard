import { loadPracticesForMap } from "@/lib/map-practices";
import { hubUsesIconStudio } from "@/lib/map-hub";
import { PageHeader } from "@/components/PageHeader";
import { MapClient } from "./MapClient";

export default async function MapPage() {
  const { practices, initialGeocodes, focalAnchor } = await loadPracticesForMap();

  const mapBlurb = hubUsesIconStudio(focalAnchor)
    ? `All ${practices.length} directory practices with addresses — pins default to Cold until you change stage. Click a pin to update stage; colour updates live. Geocoding runs in batches for practices without stored coordinates.`
    : `All ${practices.length} practices with addresses near ${focalAnchor.name}. Pins default to Cold; click a pin to change stage.`;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Map" description={mapBlurb} />
      <MapClient practices={practices} initialGeocodes={initialGeocodes} focalAnchor={focalAnchor} />
      <p className="mt-4 text-xs text-slate-500">
        Map tiles © OpenStreetMap contributors, © CARTO. Backfill coordinates with{" "}
        <code className="rounded bg-black/30 px-1 font-mono text-[10px] text-brand-300">npm run geocode:architects</code>{" "}
        (respects Nominatim rate limits).
      </p>
    </div>
  );
}
