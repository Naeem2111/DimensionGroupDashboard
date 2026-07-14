"use client";

import { useMemo, useState } from "react";
import { PRICING_TIER_LABELS } from "@/lib/ops-constants";
import {
  SALES_CALCULATOR_TIER_DEFAULT,
  SALES_CALCULATOR_TIER_MAX,
  SALES_CALCULATOR_TIER_MIN,
  blocharchMonthlyFeeGbp,
  formatGbp,
  monthlySavingGbp,
} from "@/lib/ops-sales-calculator";

const TIER_MARKS = [25, 30, 35, 40] as const;

export function OnboardingCalculatorClient() {
  const [benchmarkInput, setBenchmarkInput] = useState("3000");
  const [savingPercent, setSavingPercent] = useState(SALES_CALCULATOR_TIER_DEFAULT);

  const benchmarkFee = useMemo(() => {
    const parsed = parseFloat(benchmarkInput.replace(/,/g, ""));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }, [benchmarkInput]);

  const blocharchFee = useMemo(
    () => blocharchMonthlyFeeGbp(benchmarkFee, savingPercent),
    [benchmarkFee, savingPercent]
  );

  const monthlySaving = useMemo(
    () => monthlySavingGbp(benchmarkFee, blocharchFee),
    [benchmarkFee, blocharchFee]
  );

  const hasBenchmark = benchmarkFee > 0;

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div className="card-tool rounded-xl p-6">
        <h2 className="text-sm font-semibold text-white">Sales call calculator</h2>
        <p className="mt-1 text-xs text-slate-500">
          Enter the client&apos;s current monthly cost, then adjust the cost-saving tier to quote the
          BLOCHARCH monthly fee live on the call.
        </p>

        <label className="mt-6 block text-xs text-slate-400">
          Benchmark fee (GBP / month)
          <div className="relative mt-1">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-500">
              £
            </span>
            <input
              type="number"
              min={0}
              step={50}
              value={benchmarkInput}
              onChange={(e) => setBenchmarkInput(e.target.value)}
              placeholder="3000"
              className="block w-full rounded-md border border-white/[0.08] bg-white/[0.04] py-2 pl-8 pr-3 text-sm text-white tabular-nums"
            />
          </div>
          <span className="mt-1 block text-[10px] text-slate-600">
            Client&apos;s current monthly cost or comparable in-house fee
          </span>
        </label>

        <div className="mt-8">
          <div className="flex items-end justify-between gap-3">
            <label className="text-xs text-slate-400" htmlFor="tier-slider">
              Cost saving offered
            </label>
            <span className="text-lg font-semibold tabular-nums text-brand-300">{savingPercent}%</span>
          </div>
          <input
            id="tier-slider"
            type="range"
            min={SALES_CALCULATOR_TIER_MIN}
            max={SALES_CALCULATOR_TIER_MAX}
            step={1}
            value={savingPercent}
            onChange={(e) => setSavingPercent(Number(e.target.value))}
            className="mt-3 w-full accent-brand-500"
          />
          <div className="mt-2 flex justify-between text-[10px] text-slate-500">
            {TIER_MARKS.map((mark) => (
              <button
                key={mark}
                type="button"
                onClick={() => setSavingPercent(mark)}
                className={`rounded px-1 py-0.5 transition-colors hover:text-brand-300 ${
                  savingPercent === mark ? "font-semibold text-brand-300" : ""
                }`}
              >
                {PRICING_TIER_LABELS[`tier_${mark}` as keyof typeof PRICING_TIER_LABELS] ?? `${mark}%`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className={`rounded-xl p-6 ring-1 ${
          hasBenchmark ? "bg-brand-500/10 ring-brand-500/30" : "card-tool ring-white/[0.06]"
        }`}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          BLOCHARCH monthly fee
        </p>
        <p className="mt-2 text-4xl font-semibold tabular-nums text-white">
          {hasBenchmark ? formatGbp(blocharchFee) : "—"}
        </p>
        {hasBenchmark ? (
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-4 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Benchmark</dt>
              <dd className="tabular-nums text-slate-300">{formatGbp(benchmarkFee)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Client saves</dt>
              <dd className="tabular-nums text-emerald-300">{formatGbp(monthlySaving)}/mo</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-slate-500">Formula</dt>
              <dd className="text-xs text-slate-400">
                {formatGbp(benchmarkFee)} × (1 − {savingPercent}%) = {formatGbp(blocharchFee)}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Enter a benchmark fee to see the quoted monthly rate.</p>
        )}
      </div>

      <p className="text-xs text-slate-600">
        Tier percentages align with commercial lane pricing ({SALES_CALCULATOR_TIER_MIN}%–
        {SALES_CALCULATOR_TIER_MAX}% cost saving). Final lane fees are configured per client under
        Clients after onboarding.
      </p>
    </div>
  );
}
