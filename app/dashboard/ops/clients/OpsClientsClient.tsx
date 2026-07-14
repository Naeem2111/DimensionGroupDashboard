"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ClientAvatar } from "@/components/ops/ClientAvatar";
import { AvatarColorPicker } from "@/components/ops/AvatarColorPicker";
import { AvatarTextTonePicker } from "@/components/ops/AvatarTextTonePicker";
import { ImageUrlField } from "@/components/ops/ImageUrlField";
import type { AvatarTextTone } from "@/lib/avatar-text-tone";
import { asAvatarTextTone, DEFAULT_AVATAR_TEXT_TONE } from "@/lib/avatar-text-tone";
import { DEFAULT_AVATAR_BG } from "@/lib/hex-color";
import { clientPortalPath } from "@/lib/client-slug";

type ClientContact = { id?: string; name: string; email: string };

type ClientRow = {
  id: string;
  name: string;
  companyName: string | null;
  software: string | null;
  contacts: ClientContact[];
  phone: string | null;
  country: string | null;
  status: string;
  slug: string | null;
  publicPortalEnabled: boolean;
  notes: string | null;
  logoUrl: string | null;
  logoBgColor: string | null;
  logoTextTone: string | null;
  projectCount: number;
  commercial: {
    pricingTier: string;
    tierPercent: number;
    laneCostGbp: number;
    activeLaneCount: number;
  } | null;
};

const emptyContact = (): ClientContact => ({ name: "", email: "" });

function ClientLogoUpload({
  clientId,
  onUploaded,
}: {
  clientId: string;
  onUploaded: (logoUrl: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  async function onPick(file: File | null) {
    if (!file) return;
    setErr("");
    setUploading(true);
    try {
      const form = new FormData();
      form.set("logo", file);
      const r = await fetch(`/api/ops/clients/${clientId}/logo`, { method: "POST", body: form });
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error || "Upload failed");
        return;
      }
      onUploaded(j.logoUrl ?? "");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="md:col-span-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => void onPick(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="btn-secondary rounded-lg px-3 py-1.5 text-xs text-slate-200"
      >
        {uploading ? "Uploading…" : "Upload logo file"}
      </button>
      {err ? <p className="mt-1 text-xs text-red-400">{err}</p> : null}
    </div>
  );
}

const emptyCreate = {
  name: "",
  companyName: "",
  software: "",
  contacts: [emptyContact()],
  tierPercent: "30",
  laneCostGbp: "2041",
  activeLaneCount: "1",
  logoUrl: "",
  logoBgColor: "#ffffff",
  logoTextTone: DEFAULT_AVATAR_TEXT_TONE as AvatarTextTone,
};

function ContactFields({
  contacts,
  onChange,
}: {
  contacts: ClientContact[];
  onChange: (next: ClientContact[]) => void;
}) {
  return (
    <div className="space-y-2 md:col-span-2">
      <p className="text-xs font-medium text-slate-400">Office leads</p>
      <p className="text-[10px] text-slate-500">People at this firm who can be assigned as project leads on the client portal.</p>
      {contacts.map((row, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input
            placeholder="Office lead name"
            value={row.name}
            onChange={(e) => {
              const next = [...contacts];
              next[i] = { ...next[i], name: e.target.value };
              onChange(next);
            }}
            className="rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
          />
          <input
            type="email"
            placeholder="Email"
            value={row.email}
            onChange={(e) => {
              const next = [...contacts];
              next[i] = { ...next[i], email: e.target.value };
              onChange(next);
            }}
            className="rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
          />
          {contacts.length > 1 ? (
            <button
              type="button"
              onClick={() => onChange(contacts.filter((_, j) => j !== i))}
              className="text-xs text-slate-500 hover:text-red-300 sm:self-center"
            >
              Remove
            </button>
          ) : (
            <span className="hidden sm:block" />
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...contacts, emptyContact()])}
        className="text-xs text-brand-300 hover:text-brand-200"
      >
        + Add office lead
      </button>
    </div>
  );
}

export function OpsClientsClient() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyCreate);
  const [editForm, setEditForm] = useState({
    name: "",
    companyName: "",
    software: "",
    contacts: [emptyContact()],
    phone: "",
    country: "",
    status: "active",
    slug: "",
    publicPortalEnabled: false,
    notes: "",
    tierPercent: "30",
    laneCostGbp: "2041",
    activeLaneCount: "1",
    logoUrl: "",
    logoBgColor: DEFAULT_AVATAR_BG,
    logoTextTone: DEFAULT_AVATAR_TEXT_TONE as AvatarTextTone,
  });
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/ops/clients");
    const j = await r.json();
    if (r.ok) setClients(j.clients || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function contactsPayload(rows: ClientContact[]) {
    return rows
      .filter((c) => c.name.trim() || c.email.trim())
      .map((c) => ({
        name: c.name.trim(),
        email: c.email.trim() || null,
      }));
  }

  async function createClient(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const r = await fetch("/api/ops/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        companyName: form.companyName,
        software: form.software,
        contacts: contactsPayload(form.contacts),
        tierPercent: Number(form.tierPercent),
        laneCostGbp: Number(form.laneCostGbp),
        activeLaneCount: Number(form.activeLaneCount),
        logoUrl: form.logoUrl.trim() || null,
        logoBgColor: form.logoBgColor || null,
        logoTextTone: form.logoTextTone,
      }),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Could not create client");
      return;
    }
    setOpen(false);
    setForm(emptyCreate);
    setMsg("Client created.");
    await load();
  }

  function startEdit(c: ClientRow) {
    setEditingId(c.id);
    setEditForm({
      name: c.name,
      companyName: c.companyName ?? "",
      software: c.software ?? "",
      contacts:
        c.contacts.length > 0
          ? c.contacts.map((ct) => ({ id: ct.id, name: ct.name, email: ct.email ?? "" }))
          : [emptyContact()],
      phone: c.phone ?? "",
      country: c.country ?? "",
      status: c.status,
      slug: c.slug ?? "",
      publicPortalEnabled: c.publicPortalEnabled,
      notes: c.notes ?? "",
      tierPercent: String(c.commercial?.tierPercent ?? 30),
      laneCostGbp: String(c.commercial?.laneCostGbp ?? 2041),
      activeLaneCount: String(c.commercial?.activeLaneCount ?? 1),
      logoUrl: c.logoUrl ?? "",
      logoBgColor: c.logoBgColor ?? DEFAULT_AVATAR_BG,
      logoTextTone: (asAvatarTextTone(c.logoTextTone) ?? DEFAULT_AVATAR_TEXT_TONE) as AvatarTextTone,
    });
    setError("");
    setMsg("");
  }

  async function saveEdit(id: string) {
    setError("");
    const r = await fetch(`/api/ops/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name,
        companyName: editForm.companyName,
        software: editForm.software,
        contacts: contactsPayload(editForm.contacts),
        phone: editForm.phone,
        country: editForm.country,
        status: editForm.status,
        slug: editForm.slug.trim() || null,
        publicPortalEnabled: editForm.publicPortalEnabled,
        notes: editForm.notes,
        tierPercent: Number(editForm.tierPercent),
        laneCostGbp: Number(editForm.laneCostGbp),
        activeLaneCount: Number(editForm.activeLaneCount),
        logoUrl: editForm.logoUrl.trim() || null,
        logoBgColor: editForm.logoBgColor || null,
        logoTextTone: editForm.logoTextTone,
      }),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Could not save");
      return;
    }
    setEditingId(null);
    setMsg("Client updated.");
    await load();
  }

  async function deleteClient(id: string, name: string) {
    if (!window.confirm(`Delete client "${name}" and all linked projects? This cannot be undone.`)) return;
    setError("");
    const r = await fetch(`/api/ops/clients/${id}`, { method: "DELETE" });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Could not delete");
      return;
    }
    setEditingId(null);
    setMsg("Client deleted.");
    await load();
  }

  if (loading) return <p className="text-sm text-slate-500">Loading clients…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">{clients.length} client(s)</p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-brand-primary rounded-lg px-4 py-2 text-sm font-semibold"
        >
          New client
        </button>
      </div>

      {msg ? <p className="text-sm text-brand-300">{msg}</p> : null}

      {open && (
        <form onSubmit={createClient} className="card-tool grid gap-3 rounded-xl p-4 md:grid-cols-2">
          <label className="text-xs text-slate-400">
            Client name
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            />
          </label>
          <ImageUrlField
            label="Client logo"
            hint="Paste a direct image link or upload a file after saving. Shown as a circle in Commercial and client lists."
            displayName={form.name || "New client"}
            value={form.logoUrl}
            backgroundColor={form.logoBgColor}
            textTone={form.logoTextTone}
            onChange={(logoUrl) => setForm((f) => ({ ...f, logoUrl }))}
          />
          <AvatarColorPicker
            label="Logo circle background"
            value={form.logoBgColor}
            onChange={(logoBgColor) => setForm((f) => ({ ...f, logoBgColor }))}
            hint="Colour behind transparent PNG logos."
          />
          <AvatarTextTonePicker
            value={form.logoTextTone}
            onChange={(logoTextTone) => setForm((f) => ({ ...f, logoTextTone }))}
          />
          <label className="text-xs text-slate-400">
            Company
            <input
              value={form.companyName}
              onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs text-slate-400 md:col-span-2">
            Software used
            <input
              value={form.software}
              onChange={(e) => setForm((f) => ({ ...f, software: e.target.value }))}
              placeholder="e.g. Revit, AutoCAD, Rhino"
              className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            />
          </label>
          <ContactFields
            contacts={form.contacts}
            onChange={(contacts) => setForm((f) => ({ ...f, contacts }))}
          />
          <label className="text-xs text-slate-400">
            Tier % ({form.tierPercent}%)
            <input
              type="range"
              min={25}
              max={40}
              step={1}
              value={form.tierPercent}
              onChange={(e) => setForm((f) => ({ ...f, tierPercent: e.target.value }))}
              className="mt-2 block w-full"
            />
          </label>
          <label className="text-xs text-slate-400">
            Monthly fee per lane (£)
            <input
              type="number"
              min={0}
              value={form.laneCostGbp}
              onChange={(e) => setForm((f) => ({ ...f, laneCostGbp: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs text-slate-400">
            Active lanes
            <input
              type="number"
              min={1}
              max={20}
              value={form.activeLaneCount}
              onChange={(e) => setForm((f) => ({ ...f, activeLaneCount: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            />
          </label>
          {error ? <p className="text-sm text-red-400 md:col-span-2">{error}</p> : null}
          <div className="flex gap-2 md:col-span-2">
            <button type="submit" className="btn-brand-primary rounded-lg px-4 py-2 text-sm">
              Create client
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {clients.map((c) => (
          <div key={c.id} className="card-tool rounded-xl p-4">
            {editingId === c.id ? (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs text-slate-400">
                  Name
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                  />
                </label>
                <ImageUrlField
                  label="Client logo"
                  displayName={editForm.name || c.name}
                  value={editForm.logoUrl}
                  backgroundColor={editForm.logoBgColor}
                  textTone={editForm.logoTextTone}
                  onChange={(logoUrl) => setEditForm((f) => ({ ...f, logoUrl }))}
                />
                <ClientLogoUpload
                  clientId={c.id}
                  onUploaded={(logoUrl) => setEditForm((f) => ({ ...f, logoUrl }))}
                />
                <AvatarColorPicker
                  label="Logo circle background"
                  value={editForm.logoBgColor}
                  onChange={(logoBgColor) => setEditForm((f) => ({ ...f, logoBgColor }))}
                />
                <AvatarTextTonePicker
                  value={editForm.logoTextTone}
                  onChange={(logoTextTone) => setEditForm((f) => ({ ...f, logoTextTone }))}
                />
                <label className="text-xs text-slate-400">
                  Status
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                    className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
                <label className="text-xs text-slate-400">
                  Company
                  <input
                    value={editForm.companyName}
                    onChange={(e) => setEditForm((f) => ({ ...f, companyName: e.target.value }))}
                    className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-slate-400">
                  Phone
                  <input
                    value={editForm.phone}
                    onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                    className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-slate-400 md:col-span-2">
                  Software used
                  <input
                    value={editForm.software}
                    onChange={(e) => setEditForm((f) => ({ ...f, software: e.target.value }))}
                    placeholder="e.g. Revit, AutoCAD, Rhino"
                    className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                  />
                </label>
                <ContactFields
                  contacts={editForm.contacts}
                  onChange={(contacts) => setEditForm((f) => ({ ...f, contacts }))}
                />
                <label className="text-xs text-slate-400">
                  Tier % ({editForm.tierPercent}%)
                  <input
                    type="range"
                    min={25}
                    max={40}
                    step={1}
                    value={editForm.tierPercent}
                    onChange={(e) => setEditForm((f) => ({ ...f, tierPercent: e.target.value }))}
                    className="mt-2 block w-full"
                  />
                </label>
                <label className="text-xs text-slate-400">
                  Monthly fee / lane (£)
                  <input
                    type="number"
                    min={0}
                    value={editForm.laneCostGbp}
                    onChange={(e) => setEditForm((f) => ({ ...f, laneCostGbp: e.target.value }))}
                    className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-slate-400">
                  Lanes
                  <input
                    type="number"
                    min={1}
                    value={editForm.activeLaneCount}
                    onChange={(e) => setEditForm((f) => ({ ...f, activeLaneCount: e.target.value }))}
                    className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-slate-400 md:col-span-2">
                  Client portal slug
                  <input
                    value={editForm.slug}
                    onChange={(e) => setEditForm((f) => ({ ...f, slug: e.target.value }))}
                    placeholder="e.g. icon-architects"
                    className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                  />
                  <span className="mt-1 block text-[11px] text-slate-600">
                    Public URL: /clients/{editForm.slug.trim() || "your-slug"}
                  </span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300 md:col-span-2">
                  <input
                    type="checkbox"
                    checked={editForm.publicPortalEnabled}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, publicPortalEnabled: e.target.checked }))
                    }
                    className="rounded border-white/20"
                  />
                  Enable public client portal (no login required)
                </label>
                {editForm.publicPortalEnabled && editForm.slug.trim() ? (
                  <div className="flex flex-wrap items-center gap-2 md:col-span-2">
                    <a
                      href={clientPortalPath(editForm.slug.trim())}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand-300 hover:text-brand-200"
                    >
                      Open portal ↗
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        const url = `${window.location.origin}${clientPortalPath(editForm.slug.trim())}`;
                        void navigator.clipboard.writeText(url);
                        setMsg("Portal link copied.");
                      }}
                      className="text-xs text-slate-400 hover:text-slate-200"
                    >
                      Copy link
                    </button>
                  </div>
                ) : null}
                <label className="text-xs text-slate-400 md:col-span-2">
                  Notes
                  <textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                  />
                </label>
                <div className="flex gap-2 md:col-span-2">
                  <button
                    type="button"
                    onClick={() => void saveEdit(c.id)}
                    className="btn-brand-primary rounded-lg px-3 py-1.5 text-xs font-semibold"
                  >
                    Save
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className="text-xs text-slate-500">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteClient(c.id, c.name)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Delete client
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-3">
                  <ClientAvatar
                    name={c.name}
                    logoUrl={c.logoUrl}
                    backgroundColor={c.logoBgColor}
                    textTone={asAvatarTextTone(c.logoTextTone)}
                    size={40}
                  />
                  <div>
                  <p className="font-medium text-white">{c.name}</p>
                  <p className="text-xs text-slate-500">
                    {c.commercial?.tierPercent ?? 30}% · £
                    {c.commercial?.laneCostGbp.toLocaleString()}/lane · {c.commercial?.activeLaneCount} lane(s) ·{" "}
                    {c.projectCount} project(s)
                  </p>
                  {c.software ? <p className="text-xs text-slate-500">Software: {c.software}</p> : null}
                  {c.contacts.length > 0 ? (
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-600">Office leads</p>
                  ) : null}
                  {c.contacts.map((ct) => (
                    <p key={ct.id ?? ct.name} className="text-xs text-slate-500">
                      {ct.name}
                      {ct.email ? ` · ${ct.email}` : ""}
                    </p>
                  ))}
                  {c.publicPortalEnabled && c.slug ? (
                    <p className="mt-2 text-xs text-brand-300">
                      <a
                        href={clientPortalPath(c.slug)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-brand-200"
                      >
                        Client portal ↗
                      </a>
                      <span className="text-slate-600"> · /clients/{c.slug}</span>
                    </p>
                  ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => startEdit(c)}
                  className="text-xs text-brand-300 hover:text-brand-200"
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        ))}
        {clients.length === 0 ? <p className="text-sm text-slate-500">No clients yet.</p> : null}
      </div>
      {error && !open ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
