# n8n Local Setup Guide

Run n8n locally and connect it to your Blocarch dashboard.

## 1. Install n8n

### Option A: npx (quickest)

```bash
npx n8n
```

Opens at http://localhost:5678. No persistence by default.

### Option B: Docker (recommended, with persistence)

```bash
docker run -d \
  --name n8n \
  -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  -e DASHBOARD_URL=http://host.docker.internal:3000 \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD=changeme \
  n8nio/n8n
```

- `host.docker.internal` lets n8n reach your Next.js app on the host.
- Replace `3000` if your dashboard runs on another port.

### Option C: Docker Compose

Create `docker-compose.yml` in your project:

```yaml
services:
  n8n:
    image: n8nio/n8n
    ports:
      - "5678:5678"
    volumes:
      - n8n_data:/home/node/.n8n
    environment:
      - DASHBOARD_URL=http://host.docker.internal:3000
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=changeme
    extra_hosts:
      - "host.docker.internal:host-gateway"

volumes:
  n8n_data:
```

Run:

```bash
docker compose up -d
```

## 2. Configure your dashboard

Add to `.env` (create if missing):

```
N8N_API_KEY=your-secret-key-here
```

Use the same key in n8n when calling the dashboard (see step 4).

## 3. Import the workflow

1. Open n8n: http://localhost:5678
2. **Workflows** → **Import from File**
3. Choose `n8n-lead-outreach-workflow.json` from this folder
4. Workflow is imported

## 4. Configure the "Fetch leads from dashboard" node

1. Open the workflow
2. Double-click **Fetch leads from dashboard**
3. Set **URL** to: `={{ $env.DASHBOARD_URL || 'http://localhost:3000' }}/api/n8n/leads`
4. Add query params:
   - `status` (optional): `cold`, `no_reply`, `positive_reply`, etc.
   - `limit` (optional): e.g. `200`
   - `withEmail`: `true` (default)

**Auth:** If you set `N8N_API_KEY` in the dashboard `.env`:

- Add **Header**: `X-Api-Key` = your `N8N_API_KEY` value  
  **or**
- Add query param: `apiKey` = your `N8N_API_KEY` value

Set **DASHBOARD_URL** in n8n:

- **Settings** → **Variables** (or `.env` in n8n's folder)
- `DASHBOARD_URL` = `http://host.docker.internal:3000` (if n8n is in Docker)
- or `http://localhost:3000` (if n8n and dashboard are on the same machine)

## 5. Configure SMTP for email nodes

Each of the 4 "Send Email" nodes needs SMTP credentials:

1. **Credentials** → **Add credential** → **SMTP**
2. Enter your SMTP host, port, user, password
3. In each email node, select this credential

Alternatively use **Gmail OAuth2** if you prefer.

## 6. Configure FROM_EMAIL (optional)

Set **FROM_EMAIL** in n8n (e.g. `jethro@blocharch.com`) or it uses the default in the node.

## 7. Run the workflow

1. Start your dashboard: `npm run dev`
2. Ensure you have leads with `cold` stage and email in `architects.json` + `data/leads.json`
3. In n8n: **Execute Workflow** (manual trigger)
4. n8n fetches leads, maps fields, routes by `outreach_stage`, and sends emails

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Unauthorized" from dashboard | Set `N8N_API_KEY` in dashboard `.env` and pass it in the HTTP request |
| "Connection refused" to localhost | Use `host.docker.internal` when n8n runs in Docker |
| No leads returned | Add `?status=cold` for cold leads; ensure `architects.json` has records with email |
| Emails not sending | Check SMTP credentials and FROM_EMAIL in each Send Email node |
