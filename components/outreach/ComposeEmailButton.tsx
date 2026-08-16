"use client";

import { useState } from "react";
import type { OutreachTemplateId } from "@/lib/outreach-compose";

type ComposeResponse = {
  templateId: OutreachTemplateId;
  templateName: string;
  to: string;
  subject: string;
  body: string;
  mailto: string;
  suggestedStageAfterSend: string | null;
  templates: { id: OutreachTemplateId; name: string }[];
  error?: string;
};

export function ComposeEmailButton({
  slug,
  label = "Compose email",
  className,
  compact,
  onMarked,
}: {
  slug: string;
  label?: string;
  className?: string;
  compact?: boolean;
  onMarked?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [compose, setCompose] = useState<ComposeResponse | null>(null);
  const [templateId, setTemplateId] = useState<OutreachTemplateId | "">("");
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

  async function loadCompose(nextTemplate?: string) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (nextTemplate) params.set("template", nextTemplate);
      const res = await fetch(
        `/api/leads/${encodeURIComponent(slug)}/compose${params.toString() ? `?${params}` : ""}`
      );
      const data = (await res.json()) as ComposeResponse;
      if (!res.ok) {
        setError(data.error || "Could not build email");
        setCompose(null);
        return;
      }
      setCompose(data);
      setTemplateId(data.templateId);
    } catch {
      setError("Could not build email");
      setCompose(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleOpen() {
    setOpen(true);
    await loadCompose(templateId || undefined);
  }

  function openMailApp() {
    if (!compose?.mailto) return;
    window.location.href = compose.mailto;
  }

  async function markAsSent() {
    if (!compose) return;
    setMarking(true);
    try {
      const body: Record<string, string> = {
        lastEmailedAt: new Date().toISOString(),
      };
      if (compose.suggestedStageAfterSend) {
        body.stage = compose.suggestedStageAfterSend;
      }
      const res = await fetch(`/api/leads/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError("Opened mail, but failed to update lead stage");
        return;
      }
      setOpen(false);
      onMarked?.();
    } finally {
      setMarking(false);
    }
  }

  const btnClass =
    className ||
    (compact
      ? "text-sm font-medium text-brand-400 hover:text-brand-300"
      : "inline-flex w-fit shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-3 py-1.5 text-sm font-semibold text-slate-950 shadow-lg shadow-brand/20 transition-opacity hover:opacity-95");

  return (
    <>
      <button type="button" onClick={() => void handleOpen()} className={btnClass}>
        {label}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Compose outreach email"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/[0.1] bg-slate-950 p-5 shadow-2xl ring-1 ring-white/[0.06]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Compose email</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Opens your default mail app (cPanel / Outlook / etc.) with subject and body filled in.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/[0.06] hover:text-white"
              >
                Close
              </button>
            </div>

            {loading ? (
              <p className="py-8 text-slate-400">Preparing draft…</p>
            ) : error && !compose ? (
              <p className="py-4 text-sm text-red-300">{error}</p>
            ) : compose ? (
              <div className="space-y-4">
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-500">
                  Template
                  <select
                    value={templateId}
                    onChange={(e) => {
                      const v = e.target.value as OutreachTemplateId;
                      setTemplateId(v);
                      void loadCompose(v);
                    }}
                    className="select-console mt-1 block w-full rounded-lg px-3 py-2 text-sm"
                  >
                    {compose.templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">To</p>
                  <p className="mt-1 break-all text-sm text-slate-200">{compose.to}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Subject</p>
                  <p className="mt-1 text-sm text-white">{compose.subject}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Body</p>
                  <pre className="mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 text-sm leading-relaxed text-slate-300">
                    {compose.body}
                  </pre>
                </div>

                {error ? <p className="text-sm text-amber-300">{error}</p> : null}

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    onClick={openMailApp}
                    className="rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-brand/25 hover:opacity-95"
                  >
                    Open in mail app
                  </button>
                  <button
                    type="button"
                    disabled={marking}
                    onClick={() => void markAsSent()}
                    className="rounded-lg border border-white/[0.1] bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-white/[0.1] disabled:opacity-50"
                  >
                    {marking
                      ? "Updating…"
                      : compose.suggestedStageAfterSend
                        ? `Mark sent → ${compose.suggestedStageAfterSend.replace(/_/g, " ")}`
                        : "Mark as emailed"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
