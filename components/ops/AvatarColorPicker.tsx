type AvatarColorPickerProps = {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  hint?: string;
};

export function AvatarColorPicker({ label, value, onChange, hint }: AvatarColorPickerProps) {
  return (
    <label className="block text-xs text-slate-400">
      {label}
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 cursor-pointer rounded-md border border-white/[0.08] bg-transparent"
          aria-label={`${label} colour`}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value.trim();
            if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) onChange(v);
          }}
          className="field-console w-24 rounded-md px-2 py-1.5 text-xs"
          spellCheck={false}
        />
      </div>
      {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
    </label>
  );
}
