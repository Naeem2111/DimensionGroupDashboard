import { NextRequest } from "next/server";
import { loadTemplates, saveTemplates } from "@/lib/templates";

export async function GET() {
  const templates = loadTemplates();
  return Response.json(templates);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const templates = loadTemplates();
  const newTemplate = {
    id: body.id || `t-${Date.now()}`,
    name: body.name || "Untitled",
    subject: body.subject || "",
    body: body.body || "",
    variables: body.variables || [],
  };
  templates.push(newTemplate);
  saveTemplates(templates);
  return Response.json(newTemplate);
}
