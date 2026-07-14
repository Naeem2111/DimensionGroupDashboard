"use client";

import { useCallback, useEffect, useState } from "react";
import { ClientAvatar } from "@/components/ops/ClientAvatar";
import { AvatarUploadField } from "@/components/ops/AvatarUploadField";
import type { AvatarTextTone } from "@/lib/avatar-text-tone";
import { asAvatarTextTone, DEFAULT_AVATAR_TEXT_TONE } from "@/lib/avatar-text-tone";
import { DEFAULT_AVATAR_BG } from "@/lib/hex-color";

type AthleteRow = {
  id: string;
  username: string;
  fullName: string;
  athleteCode: string;
  email: string | null;
  status: string;
  profilePhotoUrl: string | null;
  profilePhotoBgColor: string | null;
  profilePhotoTextTone: string | null;
  baseMonthlyPayZar: number;
  monthlyHourCap: number;
  overtimeRateZar: number;
  blocharchStartDate: string;
  projectCount: number;
};

export function OpsAthletesClient() {
  const [athletes, setAthletes] = useState<AthleteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    athleteCode: "",
    username: "",
    password: "",
    email: "",
    blocharchStartDate: new Date().toISOString().slice(0, 10),
    profilePhotoUrl: "",
    profilePhotoBgColor: DEFAULT_AVATAR_BG,
    profilePhotoTextTone: DEFAULT_AVATAR_TEXT_TONE as AvatarTextTone,
  });
  const [editForm, setEditForm] = useState({
    fullName: "",
    email: "",
    status: "active",
    baseMonthlyPayZar: "20000",
    monthlyHourCap: "160",
    overtimeRateZar: "200",
    blocharchStartDate: "",
    password: "",
    profilePhotoUrl: "",
    profilePhotoBgColor: DEFAULT_AVATAR_BG,
    profilePhotoTextTone: DEFAULT_AVATAR_TEXT_TONE as AvatarTextTone,
  });
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/ops/athletes");
    const j = await r.json();
    if (r.ok) setAthletes(j.athletes || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createAthlete(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const r = await fetch("/api/ops/athletes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        profilePhotoUrl: form.profilePhotoUrl.trim() || null,
        profilePhotoBgColor: form.profilePhotoBgColor || null,
        profilePhotoTextTone: form.profilePhotoTextTone,
      }),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Could not create athlete");
      return;
    }
    setOpen(false);
    setForm({
      fullName: "",
      athleteCode: "",
      username: "",
      password: "",
      email: "",
      blocharchStartDate: new Date().toISOString().slice(0, 10),
      profilePhotoUrl: "",
      profilePhotoBgColor: DEFAULT_AVATAR_BG,
      profilePhotoTextTone: DEFAULT_AVATAR_TEXT_TONE as AvatarTextTone,
    });
    await load();
  }

  function startEdit(a: AthleteRow) {
    setEditingId(a.id);
    setEditForm({
      fullName: a.fullName,
      email: a.email ?? "",
      status: a.status,
      baseMonthlyPayZar: String(a.baseMonthlyPayZar),
      monthlyHourCap: String(a.monthlyHourCap),
      overtimeRateZar: String(a.overtimeRateZar),
      blocharchStartDate: a.blocharchStartDate,
      password: "",
      profilePhotoUrl: a.profilePhotoUrl ?? "",
      profilePhotoBgColor: a.profilePhotoBgColor ?? DEFAULT_AVATAR_BG,
      profilePhotoTextTone: (asAvatarTextTone(a.profilePhotoTextTone) ??
        DEFAULT_AVATAR_TEXT_TONE) as AvatarTextTone,
    });
    setError("");
    setMsg("");
  }

  async function saveEdit(id: string) {
    setError("");
    const body: Record<string, unknown> = {
      fullName: editForm.fullName,
      email: editForm.email || null,
      status: editForm.status,
      baseMonthlyPayZar: Number(editForm.baseMonthlyPayZar),
      monthlyHourCap: Number(editForm.monthlyHourCap),
      overtimeRateZar: Number(editForm.overtimeRateZar),
      blocharchStartDate: editForm.blocharchStartDate,
      profilePhotoUrl: editForm.profilePhotoUrl.trim() || null,
      profilePhotoBgColor: editForm.profilePhotoBgColor || null,
      profilePhotoTextTone: editForm.profilePhotoTextTone,
    };
    if (editForm.password.trim()) body.password = editForm.password.trim();

    const r = await fetch(`/api/ops/athletes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Could not save");
      return;
    }
    setEditingId(null);
    setMsg("Athlete updated.");
    await load();
  }

  if (loading) return <p className="text-sm text-slate-500">Loading athletes…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">{athletes.length} athlete(s)</p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-brand-primary rounded-lg px-4 py-2 text-sm font-semibold"
        >
          New athlete
        </button>
      </div>
      {msg ? <p className="text-sm text-brand-300">{msg}</p> : null}

      {open && (
        <form onSubmit={createAthlete} className="card-tool grid gap-3 rounded-xl p-4 md:grid-cols-2">
          <AvatarUploadField
            label="Profile photo"
            displayName={form.fullName || "New athlete"}
            photoUrl={form.profilePhotoUrl}
            backgroundColor={form.profilePhotoBgColor}
            textTone={form.profilePhotoTextTone}
            onPhotoUrlChange={(profilePhotoUrl) => setForm((f) => ({ ...f, profilePhotoUrl }))}
            onBackgroundColorChange={(profilePhotoBgColor) =>
              setForm((f) => ({ ...f, profilePhotoBgColor }))
            }
            onTextToneChange={(profilePhotoTextTone) =>
              setForm((f) => ({ ...f, profilePhotoTextTone }))
            }
            hint="Initials appear until a photo is uploaded (edit after create to upload a file)."
          />
          <label className="text-xs text-slate-400">Full name<input required value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white" /></label>
          <label className="text-xs text-slate-400">Athlete code<input required value={form.athleteCode} onChange={(e) => setForm((f) => ({ ...f, athleteCode: e.target.value.toUpperCase() }))} className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white" /></label>
          <label className="text-xs text-slate-400">Username<input required value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase() }))} className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white" /></label>
          <label className="text-xs text-slate-400">Password<input required type="password" minLength={6} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white" /></label>
          <label className="text-xs text-slate-400">Email<input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white" /></label>
          <label className="text-xs text-slate-400">Start date<input type="date" required value={form.blocharchStartDate} onChange={(e) => setForm((f) => ({ ...f, blocharchStartDate: e.target.value }))} className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white" /></label>
          {error ? <p className="text-sm text-red-400 md:col-span-2">{error}</p> : null}
          <div className="flex gap-2 md:col-span-2">
            <button type="submit" className="btn-brand-primary rounded-lg px-4 py-2 text-sm">Create athlete</button>
            <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500">Cancel</button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {athletes.map((a) => (
          <div key={a.id} className="card-tool rounded-xl p-4">
            {editingId === a.id ? (
              <div className="grid gap-3 md:grid-cols-2">
                <AvatarUploadField
                  label="Profile photo"
                  displayName={editForm.fullName || a.fullName}
                  photoUrl={editForm.profilePhotoUrl}
                  backgroundColor={editForm.profilePhotoBgColor}
                  textTone={editForm.profilePhotoTextTone}
                  onPhotoUrlChange={(profilePhotoUrl) =>
                    setEditForm((f) => ({ ...f, profilePhotoUrl }))
                  }
                  onBackgroundColorChange={(profilePhotoBgColor) =>
                    setEditForm((f) => ({ ...f, profilePhotoBgColor }))
                  }
                  onTextToneChange={(profilePhotoTextTone) =>
                    setEditForm((f) => ({ ...f, profilePhotoTextTone }))
                  }
                  uploadPath={`/api/ops/athletes/${a.id}/photo`}
                />
                <label className="text-xs text-slate-400">Full name<input value={editForm.fullName} onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))} className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white" /></label>
                <label className="text-xs text-slate-400">Status<select value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))} className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
                <label className="text-xs text-slate-400">Email<input value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white" /></label>
                <label className="text-xs text-slate-400">Start date<input type="date" value={editForm.blocharchStartDate} onChange={(e) => setEditForm((f) => ({ ...f, blocharchStartDate: e.target.value }))} className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white" /></label>
                <label className="text-xs text-slate-400">Base pay (ZAR)<input type="number" value={editForm.baseMonthlyPayZar} onChange={(e) => setEditForm((f) => ({ ...f, baseMonthlyPayZar: e.target.value }))} className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white" /></label>
                <label className="text-xs text-slate-400">Hour cap<input type="number" value={editForm.monthlyHourCap} onChange={(e) => setEditForm((f) => ({ ...f, monthlyHourCap: e.target.value }))} className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white" /></label>
                <label className="text-xs text-slate-400">Overtime rate (ZAR)<input type="number" value={editForm.overtimeRateZar} onChange={(e) => setEditForm((f) => ({ ...f, overtimeRateZar: e.target.value }))} className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white" /></label>
                <label className="text-xs text-slate-400">New password (optional)<input type="password" value={editForm.password} onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))} className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white" /></label>
                <div className="flex gap-2 md:col-span-2">
                  <button type="button" onClick={() => void saveEdit(a.id)} className="btn-brand-primary rounded-lg px-3 py-1.5 text-xs font-semibold">Save</button>
                  <button type="button" onClick={() => setEditingId(null)} className="text-xs text-slate-500">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-3">
                  <ClientAvatar
                    name={a.fullName}
                    logoUrl={a.profilePhotoUrl}
                    backgroundColor={a.profilePhotoBgColor}
                    textTone={asAvatarTextTone(a.profilePhotoTextTone)}
                    size={40}
                    objectFit="cover"
                  />
                  <div>
                    <p className="font-medium text-white">{a.fullName} <span className="text-slate-500">({a.athleteCode})</span></p>
                    <p className="text-xs text-slate-500">{a.username} · {a.monthlyHourCap}h cap · R{a.baseMonthlyPayZar.toLocaleString()} · {a.projectCount} projects</p>
                  </div>
                </div>
                <button type="button" onClick={() => startEdit(a)} className="text-xs text-brand-300 hover:text-brand-200">Edit</button>
              </div>
            )}
          </div>
        ))}
        {athletes.length === 0 ? <p className="text-sm text-slate-500">No athletes yet.</p> : null}
      </div>
      {error && !open ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
