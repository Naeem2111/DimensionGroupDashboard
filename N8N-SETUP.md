# n8n Local Setup Guide (cPanel SMTP)

Run n8n and connect it to the Dimension Group dashboard. Email sends through **cPanel SMTP**, not Gmail.

## 1. Start n8n

### Option A: npx

```bash
npx n8n
```

Open http://localhost:5678

### Option B: Docker Compose (recommended)

```bash
npm run n8n:docker
# or: docker compose -f docker-compose.n8n.yml up -d
```

Set in compose / env (see `docker-compose.n8n.yml`):

- `DASHBOARD_URL=http://host.docker.internal:3000` (n8n in Docker → Next on host)
- `N8N_API_KEY` — same secret as the dashboard
- `FROM_EMAIL=connect@dimensiongroupglobal.com`

## 2. Dashboard `.env`

```
N8N_API_KEY=generate-a-long-random-secret
# Optional: webhook if using /api/workflow/trigger
# N8N_WEBHOOK_URL=https://your-n8n/webhook/xxxx
```

## 3. Import workflow

1. n8n → **Workflows → Import from File**
2. Choose `n8n-lead-outreach-workflow.json`

## 4. cPanel SMTP credential

**Credentials → Add → SMTP**

| Setting | Value |
|---------|--------|
| Host | `mail.dimensiongroupglobal.com` |
| Port | `465` |
| SSL/TLS | Yes |
| User | `connect@dimensiongroupglobal.com` |
| Password | From cPanel → Email Accounts |

Assign this credential on all four **Send … (cPanel SMTP)** nodes.

If port 465 fails from the n8n host, try port `587` with STARTTLS.

## 5. Fetch leads node

URL (already in the import):

`{{ ($env.DASHBOARD_URL).replace(/\/$/, '') }}/api/n8n/leads`

Query params (defaults):

- `status=cold,targeted`
- `limit=25`
- `withEmail=true`

Header: `X-Api-Key` = `{{ $env.N8N_API_KEY }}`

## 6. Run

1. `npm run dev` (or deploy dashboard with matching `N8N_API_KEY`)
2. In n8n: open workflow → **Execute Workflow**
3. Confirm a test inbox received mail from connect@
4. Check dashboard lead notes / stage (`first_email_sent`)

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Unauthorized from dashboard | Match `N8N_API_KEY` on dashboard and n8n env |
| Connection refused to localhost | Use `host.docker.internal` when n8n is in Docker |
| SMTP auth failed | Use full email as username + cPanel mailbox password; try 587 STARTTLS |
| No leads | Ensure practices have email and stage `cold` / `targeted` |
| Gmail nodes still showing | Re-import this workflow (Gmail was removed) |
