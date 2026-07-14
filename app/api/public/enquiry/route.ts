import { NextRequest } from "next/server";
import {
  ingestWebsiteEnquiry,
  type QuoteEnquiryInput,
  type SimpleEnquiryInput,
} from "@/lib/website-enquiry";

function allowedOrigins(): string[] {
  const fromEnv = (process.env.WEBSITE_INGEST_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromEnv.length) return fromEnv;
  return [
    "https://dimensiongroupglobal.com",
    "https://www.dimensiongroupglobal.com",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:3000",
  ];
}

function originAllowed(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const allowed = allowedOrigins();
  if (origin && allowed.some((o) => origin === o || origin.startsWith(o))) return true;
  if (referer && allowed.some((o) => referer.startsWith(o))) return true;
  if (process.env.NODE_ENV !== "production") return true;
  return false;
}

function corsHeaders(origin: string | null): HeadersInit {
  const allowed = allowedOrigins();
  const match = origin && allowed.includes(origin) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": match,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Ingest-Key",
  };
}

function parseBody(body: unknown): QuoteEnquiryInput | SimpleEnquiryInput | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  if (o.type === "simple") {
    if (typeof o.name !== "string" || typeof o.email !== "string" || typeof o.message !== "string") {
      return null;
    }
    return { type: "simple", name: o.name, email: o.email, message: o.message };
  }
  if (o.type === "quote") {
    const fields = [
      "service",
      "company",
      "projectLocation",
      "projectType",
      "budget",
      "message",
      "region",
      "name",
      "email",
    ] as const;
    for (const key of fields) {
      if (typeof o[key] !== "string") return null;
    }
    return {
      type: "quote",
      service: o.service as string,
      company: o.company as string,
      projectLocation: o.projectLocation as string,
      projectType: o.projectType as string,
      budget: o.budget as string,
      message: o.message as string,
      region: o.region as string,
      name: o.name as string,
      email: o.email as string,
      phone: typeof o.phone === "string" ? o.phone : undefined,
    };
  }
  return null;
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  if (!originAllowed(request)) {
    return Response.json({ error: "Origin not allowed" }, { status: 403, headers });
  }

  const ingestKey = process.env.WEBSITE_INGEST_KEY?.trim();
  if (ingestKey) {
    const provided = request.headers.get("x-ingest-key");
    if (provided !== ingestKey) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers });
    }
  }

  const body = await request.json().catch(() => null);
  const parsed = parseBody(body);
  if (!parsed) {
    return Response.json({ error: "Invalid enquiry payload" }, { status: 400, headers });
  }

  try {
    const result = await ingestWebsiteEnquiry(parsed);
    return Response.json({ ok: true, lead: result }, { status: 201, headers });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save enquiry";
    return Response.json({ error: message }, { status: 400, headers });
  }
}
