import path from "path";
import fs from "fs";

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables?: string[]; // e.g. ["{{name}}", "{{contact}}"]
}

const DATA_DIR = path.join(process.cwd(), "data");
const TEMPLATES_FILE = path.join(DATA_DIR, "templates.json");

const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    id: "intro",
    name: "Introduction",
    subject: "Architectural collaboration opportunity – {{name}}",
    body: `Hi {{contact}},

I hope this email finds you well. I'm reaching out to {{name}} as we're interested in exploring potential collaboration opportunities in the architecture space.

We've been impressed by your work and would love to learn more about your practice. Would you have time for a brief call or meeting in the coming weeks?

Best regards`,
    variables: ["{{name}}", "{{contact}}"],
  },
  {
    id: "follow-up",
    name: "Follow-up",
    subject: "Following up – {{name}}",
    body: `Hi {{contact}},

I wanted to follow up on my previous email. I'd still be very interested in connecting with the team at {{name}}.

Please let me know if there's a convenient time to chat.

Best regards`,
    variables: ["{{name}}", "{{contact}}"],
  },
];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadTemplates(): EmailTemplate[] {
  ensureDataDir();
  if (!fs.existsSync(TEMPLATES_FILE)) {
    return DEFAULT_TEMPLATES;
  }
  try {
    const raw = fs.readFileSync(TEMPLATES_FILE, "utf-8");
    return JSON.parse(raw) as EmailTemplate[];
  } catch {
    return DEFAULT_TEMPLATES;
  }
}

export function saveTemplates(templates: EmailTemplate[]): void {
  ensureDataDir();
  fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2), "utf-8");
}

export function applyTemplate(template: EmailTemplate, data: Record<string, string>): { subject: string; body: string } {
  let subject = template.subject;
  let body = template.body;
  for (const [key, value] of Object.entries(data)) {
    const placeholder = `{{${key}}}`;
    subject = subject.split(placeholder).join(value || "");
    body = body.split(placeholder).join(value || "");
  }
  return { subject, body };
}
