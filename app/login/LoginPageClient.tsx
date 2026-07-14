"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/dashboard";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }
      router.push(from);
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-login-bg flex min-h-screen flex-col items-center justify-center px-4">
      <div className="mb-10 flex w-full max-w-sm flex-col items-center">
        <BrandMark variant="stack" />
        <p className="mt-4 text-center text-sm text-slate-400">Sign in to open the console</p>
      </div>
      <div className="w-full max-w-sm">
        <form
          onSubmit={handleSubmit}
          className="card-tool card-tool-hover rounded-2xl p-6 ring-1 ring-white/[0.06]"
        >
          {error && (
            <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="username" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-white placeholder-slate-500 ring-1 ring-black/20 transition-colors focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              placeholder="Username"
            />
          </div>
          <div className="mt-4">
            <label htmlFor="password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-white placeholder-slate-500 ring-1 ring-black/20 transition-colors focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-brand/30 transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in to Blocharch"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function LoginPageClient() {
  return (
    <Suspense
      fallback={
        <div className="app-login-bg flex min-h-screen items-center justify-center">
          <p className="text-slate-400">Loading…</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
