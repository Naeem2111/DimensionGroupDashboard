export type LiveFxQuote = {
  gbpToZarRate: number;
  asOf: string;
  source: string;
};

/** Fetch current GBP→ZAR from Frankfurter (no API key). */
export async function fetchLiveGbpToZarQuote(): Promise<LiveFxQuote> {
  const res = await fetch("https://api.frankfurter.app/latest?from=GBP&to=ZAR", {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Live FX unavailable (HTTP ${res.status})`);
  }
  const json = (await res.json()) as {
    date?: string;
    rates?: { ZAR?: number };
  };
  const rate = json.rates?.ZAR;
  if (!rate || !Number.isFinite(rate) || rate <= 0) {
    throw new Error("Live FX response missing ZAR rate");
  }
  return {
    gbpToZarRate: Math.round(rate * 10000) / 10000,
    asOf: json.date ?? new Date().toISOString().slice(0, 10),
    source: "frankfurter.app",
  };
}
