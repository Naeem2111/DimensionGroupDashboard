# n8n Lead Outreach – cPanel SMTP

Automates Dimension Group outreach email using the **cPanel mailbox** (SMTP send). Not Gmail.

Import file: [`n8n-lead-outreach-workflow.json`](n8n-lead-outreach-workflow.json)

## Flow

```
Cold / Targeted Email (first contact)
   ├─ Positive / Interested  → Book Call Email
   ├─ Negative / Not interested → Thank You Email
   └─ First email sent / Follow-up due → Follow-Up Email
```

Routing uses `outreach_stage` from `GET /api/n8n/leads`.

| outreach_stage | Email sent |
|----------------|------------|
| `cold`, `targeted` | First cold email → then dashboard stage `first_email_sent` |
| `first_email_sent`, `follow_up_due` | Follow-up → `follow_up_sent` |
| `positive_reply`, `interested` | Book call |
| `negative_reply`, `not_interested` | Thank you |

## Import into your n8n instance

1. In n8n: **Workflows → Import from File**
2. Select `n8n-lead-outreach-workflow.json`
3. Create **one SMTP credential** (cPanel):

| Field | Value |
|-------|--------|
| Host | `mail.dimensiongroupglobal.com` |
| Port | `465` (SSL/TLS) — if blocked try `587` + STARTTLS |
| User | `connect@dimensiongroupglobal.com` |
| Password | cPanel email account password |
| SSL/TLS | On for 465 |

4. Open each of the four **Send … (cPanel SMTP)** nodes → select that SMTP credential.
5. Set n8n environment variables (Settings → Variables, or instance env):

```
DASHBOARD_URL=https://your-dashboard-host
N8N_API_KEY=<same value as dashboard N8N_API_KEY>
FROM_EMAIL=connect@dimensiongroupglobal.com
```

6. On the dashboard (Vercel / `.env`), set the same `N8N_API_KEY`.
7. Run **Manual Trigger** once with `limit=1` or `2` to verify delivery, then use `limit=25`.

Default fetch query on the HTTP node: `status=cold,targeted&limit=25&withEmail=true`.

For follow-up runs, change `status` to `first_email_sent,follow_up_due`.

## After each send

Report nodes `POST` to `/api/n8n/lead-event` with `X-Api-Key` so the dashboard updates notes + `lastEmailedAt` (and stage for cold/follow-up).

## Security

- Do **not** put cPanel passwords or API keys inside the workflow JSON.
- The bundled workflow uses `{{ $env.N8N_API_KEY }}` only.

## Local n8n (optional)

```bash
npm run n8n:docker
# or: npx n8n
```

See [N8N-SETUP.md](N8N-SETUP.md) for Docker details.
