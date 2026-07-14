"use client";

import { useEffect, useState } from "react";
import { slugFromPracticeUrl } from "@/lib/practice-url";

type Practice = {
  url: string;
  name: string;
  email: string;
  contact: string;
  phone: string;
  website: string;
  address: string;
};

export function EditPracticeModal({
  practice,
  onClose,
  onSaved,
}: {
  practice: Practice;
  onClose: () => void;
  onSaved: (updated: Practice) => void;
}) {
  const slug = slugFromPracticeUrl(practice.url);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: practice.name,
    email: practice.email,
    contact: practice.contact,
    phone: practice.phone,
    website: practice.website,
    address: practice.address,
  });

  useEffect(() => {
    setForm({
      name: practice.name,
      email: practice.email,
      contact: practice.contact,
      phone: practice.phone,
      website: practice.website,
      address: practice.address,
    });
  }, [practice]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/practices/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to save changes");
        return;
      }
      onSaved({
        url: data.url ?? practice.url,
        name: data.name ?? form.name,
        email: data.email ?? "",
        contact: data.contact ?? "",
        phone: data.phone ?? "",
        website: data.website ?? "",
        address: data.address ?? "",
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close edit dialog"
        onClick={onClose}
      />
      <div className="modal-panel relative z-10 w-full max-w-lg rounded-2xl border border-white/[0.08] bg-slate-900 p-5 shadow-xl ring-1 ring-white/[0.06]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Edit practice</h2>
            <p className="mt-1 text-xs text-slate-400">Update contact details for {practice.name}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300" aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={(e) => void submit(e)} className="mt-4 space-y-3">
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
          <label className="block text-xs text-slate-400">
            Practice name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="field-console mt-1 w-full rounded-lg px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="block text-xs text-slate-400">
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="field-console mt-1 w-full rounded-lg px-3 py-2 text-sm"
              placeholder="Add email for lead nurturing"
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
          <label className="block text-xs text-slate-400">
            Address
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="field-console mt-1 w-full rounded-lg px-3 py-2 text-sm"
              placeholder="Optional"
            />
          </label>
          <div className="flex flex-wrap gap-2 pt-2">
            <button type="submit" disabled={saving} className="btn-brand-primary rounded-lg px-4 py-2 text-sm disabled:opacity-50">
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/[0.1] px-4 py-2 text-sm text-slate-400 hover:bg-white/[0.04]"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
