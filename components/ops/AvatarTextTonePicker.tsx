import type { AvatarTextTone } from "@/lib/avatar-text-tone";

type AvatarTextTonePickerProps = {
  label?: string;
  value: AvatarTextTone;
  onChange: (tone: AvatarTextTone) => void;
  hint?: string;
};

export function AvatarTextTonePicker({
  label = "Initials text colour",
  value,
  onChange,
  hint = "Use when there is no logo image — light text on dark circles, dark text on light circles.",
}: AvatarTextTonePickerProps) {
  return (
    <fieldset className="block text-xs text-slate-400">
      <legend className="font-normal">{label}</legend>
      <div className="mt-1.5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange("light")}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
            value === "light"
              ? "border-brand-500/40 bg-brand-500/15 text-brand-100"
              : "border-white/[0.1] bg-white/[0.04] text-slate-400 hover:bg-white/[0.07]"
          }`}
        >
          Light (white)
        </button>
        <button
          type="button"
          onClick={() => onChange("dark")}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
            value === "dark"
              ? "border-brand-500/40 bg-brand-500/15 text-brand-100"
              : "border-white/[0.1] bg-white/[0.04] text-slate-400 hover:bg-white/[0.07]"
          }`}
        >
          Dark (black)
        </button>
      </div>
      {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
    </fieldset>
  );
}
