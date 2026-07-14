# n8n Lead Outreach – Email Automation

This workflow automates the Blocharch email sequence using your scraped architect data and the templates you provided.

## Flow

```
Cold Email (first contact)
   ├─ Positive Reply     → Book Call Email
   ├─ Negative Reply     → Thank You Email
   └─ No Reply           → Follow-Up Email
         ├─ Interested   → Book Call Email
         └─ Not Interested → Thank You Email
```

Routing is done by **outreach_stage** on each lead. The dashboard API maps pipeline status to stage by default:

| outreach_stage | Email sent        |
|----------------|-------------------|
| cold           | First cold email  |
| no_reply       | Follow-up         |
| positive_reply / follow_up_interested | Book call |
| negative_reply / follow_up_not_interested | Thank you |

## Import the workflow

1. In n8n: **Workflows** → **Import from File** (or **Import from URL** if you host the JSON).
2. Select `n8n-lead-outreach-workflow.json` from this folder.
3. Configure the **Gmail** nodes (all four): create a **Gmail OAuth2** credential for jethro@blocharch.com and assign it to each Send Cold Email, Send Book Call Email, Send Thank You Email, and Send Follow-Up Email node.

## Where leads come from

**Option A – From your dashboard (recommended)**  
The **Fetch leads from dashboard** node calls:

- `GET {{ DASHBOARD_URL }}/api/n8n/leads?status=cold&limit=200`

Set the env variable **DASHBOARD_URL** in n8n to your deployed app (e.g. `https://yourapp.onrender.com`). No trailing slash.

- `?status=cold` → only leads that haven’t been contacted (cold email).
- `?status=no_reply` → for follow-up runs.
- Omit `status` to get all leads (workflow will route each by its stage).

**Option B – Manual / inject**  
Replace **Fetch leads from dashboard** with an **Inject** or **Set** node that outputs one item per lead, each with at least:

- `email`
- `name` or `practice.name`
- `contact` or `practice.contact` (used for “First Name”)
- `outreach_stage`: `cold` | `positive_reply` | `negative_reply` | `no_reply` | `follow_up_interested` | `follow_up_not_interested`

## Template variables

The workflow fills these from each lead:

- **{{ firstName }}** – First word of contact name or practice name.
- **{{ companyName }}** – Practice name.
- **{{ website }}** / **{{ websiteLink }}** – Practice website, or Blocharch’s if missing.

Set **FROM_EMAIL** in n8n (e.g. `jethro@blocharch.com`) or it will use the default in the node.

## Running the workflow

1. **Cold run:** Call the API with `?status=cold` (or trigger manually with injected leads). Only leads with an email are returned.
2. **Follow-up run:** After moving leads to `no_reply` in the dashboard, call with `?status=no_reply` to send follow-ups.
3. When a lead replies, update their **stage** in the dashboard (e.g. to `positive_reply` or `negative_reply`). On the next run they’ll get the Book Call or Thank You email.

You can run the workflow on a **schedule** (e.g. daily) and filter in the HTTP node by `status` so each run only sends one type of email (e.g. cold today, follow-up tomorrow).

## After each send: update the dashboard (`/api/n8n/lead-event`)

The bundled workflow wires **Report … → dashboard** HTTP nodes after each Gmail send. They `POST` to your app so **notes** get a timestamped line and **last emailed** is updated.

- **URL:** `{{ DASHBOARD_URL }}/api/n8n/lead-event` (same base as fetch; trailing slashes stripped in the expression).
- **Header:** `X-Api-Key: {{ $env.N8N_API_KEY }}` — must match **`N8N_API_KEY`** on the dashboard (Vercel env).
- **Body (JSON):**
  - **`appendNote`** (required) — e.g. `Cold email sent (n8n)`.
  - **`stage`** (optional) — cold send sets `no_reply` so the pipeline reflects “first email sent”.
  - **`lead_id`** — full practice URL from the map step (preferred).
  - **`email`** or **`to`** — fallback if the Gmail node drops `lead_id` (we match the practice by email).

Re-import `n8n-lead-outreach-workflow.json` after pulling, or add equivalent HTTP Request nodes in n8n. On the **Lead nurturing** page you’ll see **Last emailed** and an **Activity** preview; the practice sidebar shows the full **Notes & automation log**.
