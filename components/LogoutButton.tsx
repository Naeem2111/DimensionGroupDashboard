"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      type="button"
      className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-400 ring-1 ring-white/10 transition-colors hover:bg-white/[0.06] hover:text-slate-200"
    >
      Log out
    </button>
  );
}
