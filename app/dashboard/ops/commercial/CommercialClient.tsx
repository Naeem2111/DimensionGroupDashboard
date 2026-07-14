"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AthleteAvatar } from "@/components/ops/AthleteAvatar";
import { ClientAvatar } from "@/components/ops/ClientAvatar";
import { asAvatarTextTone } from "@/lib/avatar-text-tone";
import { LANE_MONTHLY_HOURS } from "@/lib/ops-constants";

type ClientOption = {
  id: string;
  name: string;
  logoUrl: string | null;
  logoBgColor: string | null;
  logoTextTone: string | null;
};

type ClientLaneRow = {
  clientId: string;
  clientName: string;
  clientLogoUrl: string | null;
  clientLogoBgColor: string | null;
  clientLogoTextTone: string | null;
  clientStatus: string;
  pricingTier: string;
  laneCostGbp: number;
  activeLaneCount: number;
  monthlyLaneRevenueGbp: number;
  includedHours: number;
  hoursUsed: number;
  utilizationPercent: number;
  overtimeHours: number;
  overtimeRevenueGbp: number;
  totalClientRevenueGbp: number;
  projectCount: number;
};

type LedgerRow = {
  athleteName: string;
  athleteCode: string;
  profilePhotoUrl: string | null;
  profilePhotoBgColor: string | null;
  profilePhotoTextTone: string | null;
  clientName: string;
  clientLogoUrl: string | null;
  clientLogoBgColor: string | null;
  clientLogoTextTone: string | null;
  hoursWorked: number;
  revenueGbp: number;
  athleteCostGbp: number;
  marginGbp: number;
  marginPercent: number;
};

type AthleteMonthlyRow = {
  athleteId: string;
  athleteName: string;
  profilePhotoUrl: string | null;
  profilePhotoBgColor: string | null;
  profilePhotoTextTone: string | null;
  hoursWorked: number;
  overtimeHours: number;
  revenueGbp: number;
  basePayGbp: number;
  overtimePayGbp: number;
  costGbp: number;
  marginGbp: number;
};

type CommercialData = {
  month: string;
  reportingRate: number;
  appliedRate: number;
  costConversionMode: "manual" | "live";
  liveRate: number | null;
  totalRevenueGbp: number;
  totalLaneRevenueGbp: number;
  totalOvertimeRevenueGbp: number;
  totalCostGbp: number;
  totalLaneCostGbp: number;
  totalOvertimeCostGbp: number;
  grossMarginGbp: number;
  grossMarginPercent: number;
  clientLanes: ClientLaneRow[];
  rows: LedgerRow[];
  athleteTotals: AthleteMonthlyRow[];
  clientFilter?: string | null;
};

type ExchangeRate = {
  id: string;
  effectiveMonth: string;
  gbpToZarRate: number;
  rateType: "live" | "reporting";
  activeFlag: boolean;
};

type CommercialSettings = {
  costConversionMode: "manual" | "live";
  appliedRate: number;
  reportingRate: number;
  storedLiveRate: number | null;
  liveQuote: { gbpToZarRate: number; asOf: string; source: string } | null;
};

function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function CommercialClient() {
  const [month, setMonth] = useState(currentMonth());
  const [clientId, setClientId] = useState("");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [ledger, setLedger] = useState<CommercialData | null>(null);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [fxSettings, setFxSettings] = useState<CommercialSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [rateForm, setRateForm] = useState({ effectiveMonth: currentMonth(), gbpToZarRate: "24", rateType: "reporting" });
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    void fetch("/api/ops/clients")
      .then((r) => r.json())
      .then((j) => {
        if (j.clients) {
          setClients(
            j.clients.map(
              (c: {
                id: string;
                name: string;
                logoUrl?: string | null;
                logoBgColor?: string | null;
                logoTextTone?: string | null;
              }) => ({
                id: c.id,
                name: c.name,
                logoUrl: c.logoUrl ?? null,
                logoBgColor: c.logoBgColor ?? null,
                logoTextTone: c.logoTextTone ?? null,
              })
            )
          );
        }
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ month });
    if (clientId) q.set("clientId", clientId);
    const [cr, rr, fx] = await Promise.all([
      fetch(`/api/ops/commercial?${q}`),
      fetch("/api/ops/exchange-rates"),
      fetch("/api/ops/commercial-settings"),
    ]);
    const cj = await cr.json();
    const rj = await rr.json();
    const fj = await fx.json();
    if (cr.ok) setLedger(cj);
    if (rr.ok) setRates(rj.rates || []);
    if (fx.ok) setFxSettings(fj);
    setLoading(false);
  }, [month, clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId) ?? null,
    [clients, clientId]
  );

  const reportingRate = useMemo(
    () => rates.find((r) => r.rateType === "reporting" && r.activeFlag && r.effectiveMonth === month),
    [rates, month]
  );

  async function setCostMode(mode: "manual" | "live") {
    setError("");
    setMsg("");
    const r = await fetch("/api/ops/commercial-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ costConversionMode: mode }),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Could not update conversion mode");
      return;
    }
    setMsg(mode === "live" ? "Using live GBP→ZAR for athlete costs." : "Using manual reporting rate for athlete costs.");
    void load();
  }

  async function addRate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    const r = await fetch("/api/ops/exchange-rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        effectiveMonth: rateForm.effectiveMonth,
        gbpToZarRate: Number(rateForm.gbpToZarRate),
        rateType: rateForm.rateType,
      }),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Could not save rate");
      return;
    }
    setMsg("Exchange rate saved.");
    void load();
  }

  if (loading && !ledger) return <p className="text-sm text-slate-500">Loading commercial data…</p>;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-xs text-slate-400">
          Month
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mt-1 block rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="text-xs text-slate-400">
          Client / firm
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="select-console mt-1 block min-w-[14rem] rounded-md px-3 py-2 text-sm"
          >
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {selectedClient ? (
          <p className="flex items-center gap-2 pb-2 text-xs text-slate-400">
            <ClientAvatar
              name={selectedClient.name}
              logoUrl={selectedClient.logoUrl}
              backgroundColor={selectedClient.logoBgColor}
              textTone={asAvatarTextTone(selectedClient.logoTextTone)}
              size={22}
            />
            Filtering commercial data to {selectedClient.name}
          </p>
        ) : null}
        {ledger ? (
          <p className="pb-2 text-xs text-slate-500">
            Athlete costs: £1 = R{ledger.appliedRate.toFixed(2)} (
            {ledger.costConversionMode === "live" ? "live" : "manual reporting"})
            {ledger.liveRate != null ? ` · Live ref R${ledger.liveRate.toFixed(2)}` : ""}
          </p>
        ) : null}
      </div>

      {ledger ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card-tool rounded-xl p-4">
              <p className="text-[10px] uppercase text-slate-500">Lane revenue</p>
              <p className="mt-1 text-xl font-semibold text-white">
                £{ledger.totalLaneRevenueGbp.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-500">Per client × lanes (monthly)</p>
            </div>
            <div className="card-tool rounded-xl p-4">
              <p className="text-[10px] uppercase text-slate-500">Overtime billing</p>
              <p className="mt-1 text-xl font-semibold text-white">
                £{ledger.totalOvertimeRevenueGbp.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-500">Hours over lane capacity</p>
            </div>
            <div className="card-tool rounded-xl p-4">
              <p className="text-[10px] uppercase text-slate-500">Athlete lane cost</p>
              <p className="mt-1 text-xl font-semibold text-white">
                £{ledger.totalLaneCostGbp.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                OT cost £{ledger.totalOvertimeCostGbp.toLocaleString()} · total £
                {ledger.totalCostGbp.toLocaleString()}
              </p>
            </div>
            <div className="card-tool rounded-xl p-4">
              <p className="text-[10px] uppercase text-slate-500">Gross margin</p>
              <p className="mt-1 text-xl font-semibold text-brand-300">
                £{ledger.grossMarginGbp.toLocaleString()} ({ledger.grossMarginPercent}%)
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Total billed £{ledger.totalRevenueGbp.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="card-tool overflow-x-auto rounded-xl">
            <div className="border-b border-white/[0.06] px-4 py-3">
              <h2 className="text-sm font-semibold text-white">Client lanes (billing)</h2>
              <p className="mt-1 text-xs text-slate-500">
                {clientId
                  ? "Lane billing and utilization for the selected firm this month."
                  : `Each active lane bills at the tier rate for the month. Project hours below show utilization against ${LANE_MONTHLY_HOURS}h included per lane.`}
              </p>
            </div>
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-xs uppercase text-slate-500">
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Lanes</th>
                  <th className="px-4 py-3">£/lane</th>
                  <th className="px-4 py-3">Monthly billing</th>
                  <th className="px-4 py-3">Hours used</th>
                  <th className="px-4 py-3">Capacity</th>
                  <th className="px-4 py-3">Util %</th>
                  <th className="px-4 py-3">OT £</th>
                  <th className="px-4 py-3">Projects</th>
                </tr>
              </thead>
              <tbody>
                {ledger.clientLanes.map((lane) => (
                  <tr key={lane.clientId} className="border-b border-white/[0.04] text-slate-300">
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-2">
                        <ClientAvatar
                          name={lane.clientName}
                          logoUrl={lane.clientLogoUrl}
                          backgroundColor={lane.clientLogoBgColor}
                          textTone={asAvatarTextTone(lane.clientLogoTextTone)}
                          size={32}
                        />
                        {lane.clientName}
                      </span>
                      {lane.clientStatus !== "active" ? (
                        <span className="ml-1 text-xs text-amber-400">({lane.clientStatus})</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 tabular-nums">{lane.activeLaneCount}</td>
                    <td className="px-4 py-2 tabular-nums">£{lane.laneCostGbp.toLocaleString()}</td>
                    <td className="px-4 py-2 tabular-nums font-medium text-white">
                      £{lane.monthlyLaneRevenueGbp.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 tabular-nums">{lane.hoursUsed}</td>
                    <td className="px-4 py-2 tabular-nums text-slate-500">{lane.includedHours}h</td>
                    <td className="px-4 py-2 tabular-nums">
                      <span
                        className={
                          lane.utilizationPercent > 100
                            ? "text-amber-300"
                            : lane.utilizationPercent >= 80
                              ? "text-brand-300"
                              : ""
                        }
                      >
                        {lane.utilizationPercent}%
                      </span>
                    </td>
                    <td className="px-4 py-2 tabular-nums">
                      {lane.overtimeRevenueGbp > 0 ? `£${lane.overtimeRevenueGbp.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-slate-500">{lane.projectCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ledger.clientLanes.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">
                No clients with commercial profiles yet. Add a client under Athlete operations → Clients.
              </p>
            ) : null}
          </div>

          <div className="card-tool overflow-x-auto rounded-xl">
            <div className="border-b border-white/[0.06] px-4 py-3">
              <h2 className="text-sm font-semibold text-white">Athlete utilization (projects)</h2>
              <p className="mt-1 text-xs text-slate-500">
                {clientId
                  ? "Hours and margin attributed to the selected client from daily logs."
                  : "Hours from daily logs allocate athlete cost; revenue share is proportional to hours on each client."}
              </p>
            </div>
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-xs uppercase text-slate-500">
                  <th className="px-4 py-3">Athlete</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Hours (usage)</th>
                  <th className="px-4 py-3">Revenue share</th>
                  <th className="px-4 py-3">Cost</th>
                  <th className="px-4 py-3">Margin</th>
                </tr>
              </thead>
              <tbody>
                {ledger.rows.map((row, i) => (
                  <tr key={i} className="border-b border-white/[0.04] text-slate-300">
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-2">
                        <AthleteAvatar
                          name={row.athleteName}
                          photoUrl={row.profilePhotoUrl}
                          backgroundColor={row.profilePhotoBgColor}
                          textTone={asAvatarTextTone(row.profilePhotoTextTone)}
                          size={28}
                        />
                        <span>
                          {row.athleteName}
                          <span className="ml-1 text-slate-500">({row.athleteCode})</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-2">
                        <ClientAvatar
                          name={row.clientName}
                          logoUrl={row.clientLogoUrl}
                          backgroundColor={row.clientLogoBgColor}
                          textTone={asAvatarTextTone(row.clientLogoTextTone)}
                          size={32}
                        />
                        {row.clientName}
                      </span>
                    </td>
                    <td className="px-4 py-2 tabular-nums">{row.hoursWorked}</td>
                    <td className="px-4 py-2 tabular-nums">£{row.revenueGbp.toLocaleString()}</td>
                    <td className="px-4 py-2 tabular-nums">£{row.athleteCostGbp.toLocaleString()}</td>
                    <td className="px-4 py-2 tabular-nums text-brand-300">
                      £{row.marginGbp.toLocaleString()} ({row.marginPercent}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ledger.rows.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">
                {clientId
                  ? "No project hours logged for this client this month."
                  : "No project hours logged this month — lane billing above still applies for active clients."}
              </p>
            ) : null}
          </div>

          <div className="card-tool overflow-x-auto rounded-xl">
            <div className="border-b border-white/[0.06] px-4 py-3">
              <h2 className="text-sm font-semibold text-white">Athlete monthly breakdown</h2>
              <p className="mt-1 text-xs text-slate-500">
                {clientId
                  ? "Per-athlete hours, revenue, and margin for the selected client."
                  : "Per-athlete earnings, revenue produced, and Blocharch margin for the month."}
              </p>
            </div>
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-xs uppercase text-slate-500">
                  <th className="px-4 py-3">Athlete</th>
                  <th className="px-4 py-3">Hours</th>
                  <th className="px-4 py-3">OT hrs</th>
                  <th className="px-4 py-3">Revenue</th>
                  <th className="px-4 py-3">Lane pay</th>
                  <th className="px-4 py-3">OT pay</th>
                  <th className="px-4 py-3">Total pay</th>
                  <th className="px-4 py-3">Margin</th>
                </tr>
              </thead>
              <tbody>
                {(ledger.athleteTotals ?? []).map((a) => (
                  <tr key={a.athleteId} className="border-b border-white/[0.04] text-slate-300">
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-2">
                        <AthleteAvatar
                          name={a.athleteName}
                          photoUrl={a.profilePhotoUrl}
                          backgroundColor={a.profilePhotoBgColor}
                          textTone={asAvatarTextTone(a.profilePhotoTextTone)}
                          size={28}
                        />
                        {a.athleteName}
                      </span>
                    </td>
                    <td className="px-4 py-2 tabular-nums">{a.hoursWorked}</td>
                    <td className="px-4 py-2 tabular-nums">{a.overtimeHours}</td>
                    <td className="px-4 py-2 tabular-nums">£{a.revenueGbp.toLocaleString()}</td>
                    <td className="px-4 py-2 tabular-nums">£{a.basePayGbp.toLocaleString()}</td>
                    <td className="px-4 py-2 tabular-nums">£{a.overtimePayGbp.toLocaleString()}</td>
                    <td className="px-4 py-2 tabular-nums">£{a.costGbp.toLocaleString()}</td>
                    <td className="px-4 py-2 tabular-nums text-brand-300">
                      £{a.marginGbp.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card-tool rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white">Exchange rates</h2>
          <p className="mt-1 text-xs text-slate-500">
            Choose manual reporting rate or live market rate when converting athlete ZAR pay to GBP.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void setCostMode("manual")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ring-1 ${
                (fxSettings?.costConversionMode ?? ledger?.costConversionMode) === "manual"
                  ? "bg-brand-500/20 text-brand-200 ring-brand-500/30"
                  : "bg-white/[0.04] text-slate-400 ring-white/[0.08]"
              }`}
            >
              Manual reporting rate
            </button>
            <button
              type="button"
              onClick={() => void setCostMode("live")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ring-1 ${
                (fxSettings?.costConversionMode ?? ledger?.costConversionMode) === "live"
                  ? "bg-brand-500/20 text-brand-200 ring-brand-500/30"
                  : "bg-white/[0.04] text-slate-400 ring-white/[0.08]"
              }`}
            >
              Live market rate
            </button>
          </div>
          {fxSettings?.liveQuote ? (
            <p className="mt-2 text-sm text-slate-300">
              Live now: £1 = R{fxSettings.liveQuote.gbpToZarRate} ({fxSettings.liveQuote.asOf})
            </p>
          ) : (
            <p className="mt-2 text-sm text-amber-300">Live quote unavailable — using stored or reporting rate.</p>
          )}
          {reportingRate ? (
            <p className="mt-2 text-sm text-slate-300">
              Manual reporting ({month}): £1 = R{reportingRate.gbpToZarRate}
            </p>
          ) : (
            <p className="mt-2 text-sm text-amber-300">No reporting rate set — using default R24.</p>
          )}
          <form onSubmit={addRate} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-400">
              Month
              <input
                type="month"
                value={rateForm.effectiveMonth}
                onChange={(e) => setRateForm((f) => ({ ...f, effectiveMonth: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="text-xs text-slate-400">
              GBP → ZAR
              <input
                type="number"
                step="0.0001"
                min={1}
                required
                value={rateForm.gbpToZarRate}
                onChange={(e) => setRateForm((f) => ({ ...f, gbpToZarRate: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="text-xs text-slate-400 sm:col-span-2">
              Type
              <select
                value={rateForm.rateType}
                onChange={(e) => setRateForm((f) => ({ ...f, rateType: e.target.value }))}
                className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
              >
                <option value="reporting">Reporting (ledger)</option>
                <option value="live">Live (reference)</option>
              </select>
            </label>
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand-500 sm:col-span-2"
            >
              Set rate
            </button>
          </form>
          <ul className="mt-4 max-h-40 space-y-1 overflow-y-auto text-xs text-slate-400">
            {rates.slice(0, 12).map((r) => (
              <li key={r.id}>
                {r.effectiveMonth} · {r.rateType} · R{r.gbpToZarRate}
                {r.activeFlag ? " · active" : ""}
              </li>
            ))}
          </ul>
        </div>

        <div className="card-tool rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white">Daily logs</h2>
          <p className="mt-1 text-xs text-slate-500">
            Athletes can edit previous daily logs by default. Manage submissions under Ops → Submissions.
          </p>
        </div>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {msg ? <p className="text-sm text-brand-300">{msg}</p> : null}
    </div>
  );
}
