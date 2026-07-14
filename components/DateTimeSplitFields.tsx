"use client";

export type DateTimeSplitValue = { date: string; time: string; ampm: "AM" | "PM" };

const inputClass =
  "mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white";

export function DateTimeSplitFields({
  value,
  onChange,
  label,
  required = false,
}: {
  value: DateTimeSplitValue;
  onChange: (v: DateTimeSplitValue) => void;
  label: string;
  required?: boolean;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs text-slate-400">
        {label}
        {required ? <span className="text-red-400"> *</span> : null}
      </legend>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs text-slate-500">
          Date
          <input
            type="date"
            required={required}
            value={value.date}
            onChange={(e) => onChange({ ...value, date: e.target.value })}
            className={inputClass}
          />
        </label>
        <label className="text-xs text-slate-500">
          Time
          <input
            type="text"
            required={required}
            placeholder="9:30"
            value={value.time}
            onChange={(e) => onChange({ ...value, time: e.target.value })}
            className={inputClass}
          />
        </label>
        <label className="text-xs text-slate-500">
          AM / PM
          <select
            value={value.ampm}
            onChange={(e) => onChange({ ...value, ampm: e.target.value as "AM" | "PM" })}
            className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
          >
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </label>
      </div>
    </fieldset>
  );
}
