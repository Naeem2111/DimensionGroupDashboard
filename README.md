# Dimension Group Dashboard

Marketing lead console for [Dimension Group](https://dimensiongroupglobal.com/). Built from the Blocharch stack: **Next.js 14**, **Prisma**, **Postgres**, hosted on **Vercel** (same pattern as Blocharch).

## Features

- **Overview** — pipeline stats and recent activity
- **Leads** — contacts from the website and manual entries
- **Map** — lead locations
- **Lead nurturing** — outreach workflow and templates
- **Marketing notifications**
- **Public enquiry API** — ingests submissions from the static site contact form

## Local development

```bash
npm install
cp .env.example .env
# Set DATABASE_URL and DG_SESSION_SECRET in .env
npm run db:push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Default bootstrap login (when no users exist): **admin** / **changeme** — change via `DG_ADMIN_USERNAME` and `DG_ADMIN_PASSWORD`.

## Deploy on Vercel

1. Push this repo to GitHub: [DimensionGroupDashboard](https://github.com/Naeem2111/DimensionGroupDashboard.git)
2. Import the project in Vercel
3. Add **Postgres** (Vercel Postgres or Neon) and set `DATABASE_URL`
4. Set `DG_SESSION_SECRET` (16+ random characters)
5. Set `WEBSITE_INGEST_ORIGINS` to your live site URL(s)
6. Deploy

After deploy, set the static site config in `js/main.js`:

```javascript
var ENQUIRY_API = "https://YOUR-VERCEL-URL/api/public/enquiry";
```

## Website contact form

The static site (`Dimension Group` repo) POSTs JSON to `/api/public/enquiry`:

- **Quote wizard** — `{ type: "quote", service, company, projectLocation, projectType, budget, message, region, name, email, phone? }`
- **Simple form** — `{ type: "simple", name, email, message }`

The API validates `Origin` / `Referer` against `WEBSITE_INGEST_ORIGINS`. Each submission creates or updates a lead with stage **interested** and an inbound outreach log.

If `ENQUIRY_API` is empty on the static site, forms fall back to `mailto:`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build (runs `prisma db push`) |
| `npm run db:push` | Sync Prisma schema to database |
| `npm run db:seed` | Seed architects from `architects.json` (optional) |
