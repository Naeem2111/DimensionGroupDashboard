"use client";

import { useState } from "react";
import Link from "next/link";

export function AddPracticeForm({
  onCreated,
  compact = false,
}: {
  onCreated?: (practice: { slug: string; name: string; url: string }) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ slug: string; name: string } | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    contact: "",
    phone: "",
    website: "",
    address: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setCreated(null);
    try {
      const res = await fetch("/api/practices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to add practice");
        return;
      }
      setCreated({ slug: data.slug, name: data.name });
      onCreated?.(data);
      setForm({ name: "", email: "", contact: "", phone: "", website: "", address: "" });
      if (compact) setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-brand-primary rounded-lg px-4 py-2 text-sm"
      >
        + Add practice
      </button>
    );
  }

  return (
    <div className="card-tool rounded-2xl p-5 ring-1 ring-white/[0.06]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Add practice manually</h2>
          <p className="mt-1 text-xs text-slate-400">
            For firms not in the directory. Name and email are required — they appear on Lead nurturing immediately.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError("");
            setCreated(null);
          }}
          className="text-slate-500 hover:text-slate-300"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {created ? (
        <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          <p>
            Added <strong>{created.name}</strong> to Lead nurturing.
          </p>
          <Link
            href={`/dashboard/practices/${encodeURIComponent(created.slug)}`}
            className="mt-2 inline-block font-medium text-brand-300 hover:text-brand-200"
          >
            Open practice →
          </Link>
        </div>
      ) : null}

      <form onSubmit={(e) => void submit(e)} className="mt-4 space-y-3">
        {error ? <p className="text-xs text-red-400">{error}</p> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-slate-400">
            Practice name <span className="text-red-400">*</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="field-console mt-1 w-full rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. Smith Architects"
              required
            />
          </label>
          <label className="block text-xs text-slate-400">
            Email <span className="text-red-400">*</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="field-console mt-1 w-full rounded-lg px-3 py-2 text-sm"
              placeholder="hello@practice.com"
              required
            />
          </label>
          <label className="block text-xs text-slate-400">
            Contact person
            <input
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              className="field-console mt-1 w-full rounded-lg px-3 py-2 text-sm"
              placeholder="Optional"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Contact number
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="field-console mt-1 w-full rounded-lg px-3 py-2 text-sm"
              placeholder="Optional"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Website
            <input
              type="url"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              className="field-console mt-1 w-full rounded-lg px-3 py-2 text-sm"
              placeholder="https://"
            />
          </label>
        </div>
        <label className="block text-xs text-slate-400">
          Address
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="field-console mt-1 w-full rounded-lg px-3 py-2 text-sm"
            placeholder="Optional — helps map placement later"
          />
        </label>
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="submit" disabled={saving} className="btn-brand-primary rounded-lg px-4 py-2 text-sm disabled:opacity-50">
            {saving ? "Adding…" : "Add to Lead nurturing"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-white/[0.1] px-4 py-2 text-sm text-slate-400 hover:bg-white/[0.04]"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
