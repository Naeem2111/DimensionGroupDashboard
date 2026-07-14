"use client";

import { useCallback, useEffect, useState } from "react";

type UserRow = {
  id: string;
  username: string;
  role: "admin" | "manager" | "user";
  disabled?: boolean;
  createdAt: string;
};

export function AdminUsersClient({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [createForm, setCreateForm] = useState({ username: "", password: "", role: "user" as "user" | "admin" | "manager" });
  const [creating, setCreating] = useState(false);
  const [pwDraft, setPwDraft] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setError("");
    const r = await fetch("/api/admin/users");
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Failed to load users");
      setUsers([]);
      return;
    }
    setUsers(j.users as UserRow[]);
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setCreating(true);
    try {
      const r = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: createForm.username,
          password: createForm.password,
          role: createForm.role,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || "Create failed");
        return;
      }
      setMsg(`Created user “${j.user.username}”.`);
      setCreateForm({ username: "", password: "", role: "user" });
      await refresh();
    } finally {
      setCreating(false);
    }
  }

  async function patchUser(id: string, body: Record<string, unknown>) {
    setError("");
    setMsg("");
    const r = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Update failed");
      return;
    }
    setMsg("Saved.");
    await refresh();
  }

  async function removeUser(id: string, username: string) {
    if (!window.confirm(`Delete user “${username}”? This cannot be undone.`)) return;
    setError("");
    setMsg("");
    const r = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, { method: "DELETE" });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Delete failed");
      return;
    }
    setMsg("User removed.");
    await refresh();
  }

  async function applyPassword(id: string) {
    const pw = (pwDraft[id] || "").trim();
    if (pw.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    await patchUser(id, { password: pw });
    setPwDraft((d) => ({ ...d, [id]: "" }));
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading users…</p>;
  }

  return (
    <div className="space-y-10">
      {error ? (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/20" role="alert">
          {error}
        </p>
      ) : null}
      {msg ? (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300 ring-1 ring-emerald-500/20">{msg}</p>
      ) : null}

      <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 ring-1 ring-white/[0.04]">
        <h2 className="text-sm font-semibold text-slate-200">Create user</h2>
        <p className="mt-1 text-xs text-slate-500">New accounts can sign in immediately with the password you set.</p>
        <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="block min-w-[160px] flex-1 text-xs text-slate-400">
            Username
            <input
              className="mt-1 w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-slate-100 outline-none ring-1 ring-black/20 focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/40"
              value={createForm.username}
              onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))}
              autoComplete="off"
              required
            />
          </label>
          <label className="block min-w-[160px] flex-1 text-xs text-slate-400">
            Password
            <input
              type="password"
              className="mt-1 w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-slate-100 outline-none ring-1 ring-black/20 focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/40"
              value={createForm.password}
              onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
              autoComplete="new-password"
              required
              minLength={6}
            />
          </label>
          <label className="block w-full min-w-[120px] text-xs text-slate-400 sm:w-40">
            Role
            <select
              className="select-console mt-1 w-full rounded-md px-3 py-2 text-sm outline-none focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/40"
              value={createForm.role}
              onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value as "user" | "admin" | "manager" }))}
            >
              <option value="user">User</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={creating}
            className="btn-brand-primary rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create user"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] ring-1 ring-white/[0.04]">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-200">Existing users</h2>
          <p className="mt-1 text-xs text-slate-500">Grant or revoke access, promote to admin, or reset passwords.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-xs uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3 font-medium">User</th>
                <th className="px-3 py-3 font-medium">Role</th>
                <th className="px-3 py-3 font-medium">Access</th>
                <th className="px-3 py-3 font-medium">New password</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-5 py-3">
                    <span className="font-medium text-slate-200">{u.username}</span>
                    {u.id === currentUserId ? (
                      <span className="ml-2 text-[10px] font-semibold uppercase text-brand-400">You</span>
                    ) : null}
                    <p className="mt-0.5 text-[11px] text-slate-600">
                      Added {new Date(u.createdAt).toLocaleDateString()}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      className="select-console rounded-md px-2 py-1.5 text-xs outline-none focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/40"
                      value={u.role}
                      onChange={(e) => patchUser(u.id, { role: e.target.value })}
                    >
                      <option value="user">User</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => patchUser(u.id, { disabled: !u.disabled })}
                      className={`access-toggle rounded-md px-2.5 py-1 text-xs font-medium ring-1 transition-colors ${
                        u.disabled
                          ? "access-grant bg-emerald-500/10 text-emerald-300 ring-emerald-500/25 hover:bg-emerald-500/15"
                          : "access-revoke bg-amber-500/10 text-amber-200 ring-amber-500/25 hover:bg-amber-500/15"
                      }`}
                    >
                      {u.disabled ? "Grant access" : "Revoke access"}
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="password"
                        className="min-w-[120px] flex-1 rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 text-xs text-slate-100 outline-none ring-1 ring-black/20 focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/40"
                        placeholder="Min 6 chars"
                        value={pwDraft[u.id] ?? ""}
                        onChange={(e) => setPwDraft((d) => ({ ...d, [u.id]: e.target.value }))}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => applyPassword(u.id)}
                        className="shrink-0 rounded-md bg-white/[0.06] px-2 py-1 text-xs font-medium text-slate-200 ring-1 ring-white/10 hover:bg-white/[0.1]"
                      >
                        Set
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {u.id !== currentUserId ? (
                      <button
                        type="button"
                        onClick={() => removeUser(u.id, u.username)}
                        className="text-xs font-medium text-red-400/90 hover:text-red-300"
                      >
                        Delete
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
