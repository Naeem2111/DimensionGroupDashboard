"use client";

import { useEffect, useState } from "react";
import type { AvatarTextTone } from "@/lib/avatar-text-tone";
import { ClientAvatar } from "@/components/ops/ClientAvatar";

type ImageUrlFieldProps = {
  label: string;
  hint?: string;
  displayName: string;
  value: string;
  onChange: (url: string) => void;
  backgroundColor?: string | null;
  textTone?: AvatarTextTone | null;
  disabled?: boolean;
};

export function ImageUrlField({
  label,
  hint = "Paste a direct image link (http or https). Shown as a circle avatar.",
  displayName,
  value,
  onChange,
  backgroundColor,
  textTone,
  disabled = false,
}: ImageUrlFieldProps) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const previewUrl = draft.trim() || value.trim() || null;

  function applyUrl() {
    const trimmed = draft.trim();
    if (!trimmed) {
      setError("");
      onChange("");
      return;
    }
    if (!/^https?:\/\//i.test(trimmed)) {
      setError("URL must start with http:// or https://");
      return;
    }
    setError("");
    onChange(trimmed);
  }

  return (
    <div className="flex flex-wrap items-start gap-3 md:col-span-2">
      <ClientAvatar
        name={displayName}
        logoUrl={previewUrl}
        backgroundColor={backgroundColor}
        textTone={textTone}
        size={48}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-medium text-slate-400">{label}</p>
        {hint ? <p className="text-[11px] text-slate-500">{hint}</p> : null}
        <div className="flex flex-wrap gap-2">
          <input
            type="url"
            value={draft}
            disabled={disabled}
            onChange={(e) => {
              setDraft(e.target.value);
              setError("");
            }}
            onBlur={() => applyUrl()}
            placeholder="https://…"
            className="min-w-[12rem] flex-1 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm text-white placeholder-slate-600"
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => applyUrl()}
            className="rounded-lg bg-white/[0.08] px-3 py-1.5 text-xs text-slate-200 hover:bg-white/[0.12] disabled:opacity-50"
          >
            Apply
          </button>
          {value || draft ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setDraft("");
                setError("");
                onChange("");
              }}
              className="text-xs text-slate-500 hover:text-red-300 disabled:opacity-50"
            >
              Clear
            </button>
          ) : null}
        </div>
        {error ? <p className="text-xs text-red-400">{error}</p> : null}
      </div>
    </div>
  );
}
