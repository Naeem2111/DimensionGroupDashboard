# Google Calendar setup (Jethro — Book a Call)

The console uses **Google Calendar API** with a long-lived **refresh token** so the server can read free/busy times and create events when you approve check-ins. You do **not** need to embed OAuth in the app for athletes — only one-time setup for Jethro’s Google account.

## 1. Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project (e.g. `Blocharch Console`).
3. **APIs & Services → Library** → enable **Google Calendar API**.

## 2. OAuth consent screen

1. **APIs & Services → OAuth consent screen**.
2. User type: **Internal** (Google Workspace) or **External** (personal Gmail).
3. Add scopes:
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/calendar.events`
4. Add your email as a test user if the app is in **Testing** mode.

## 3. OAuth client credentials

1. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Application type: **Web application** (or Desktop if you use the script below locally).
3. Authorized redirect URIs: add `http://localhost:3333/oauth2callback` (for the one-time token script).
4. Copy **Client ID** and **Client secret**.

## 4. Refresh token (one-time)

Run locally from the repo root (replace placeholders):

```bash
node scripts/google-oauth-refresh-token.mjs
```

Or use [Google OAuth Playground](https://developers.google.com/oauthplayground/):

1. Configure your own OAuth credentials (gear icon).
2. Select Calendar API v3 scopes: `calendar` and `calendar.events`.
3. Authorize → Exchange authorization code for tokens.
4. Copy the **Refresh token** (not the access token).

## 5. Environment variables

Add to `.env` (see `.env.example`):

```env
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_REFRESH_TOKEN=1//0g...
GOOGLE_CALENDAR_ID=primary
GOOGLE_CALENDAR_TIMEZONE=Europe/London
```

| Variable | Required | Notes |
|----------|----------|--------|
| `GOOGLE_CLIENT_ID` | Yes | OAuth client |
| `GOOGLE_CLIENT_SECRET` | Yes | OAuth client |
| `GOOGLE_REFRESH_TOKEN` | Yes | Jethro’s calendar access |
| `GOOGLE_CALENDAR_ID` | No | Default `primary`; use a specific calendar ID if needed |
| `GOOGLE_CALENDAR_TIMEZONE` | No | Default `Europe/London` |
| `GOOGLE_SLOT_MINUTES` | No | Slot length, default `30` |
| `GOOGLE_WORKDAY_START` | No | Hour (0–23), default `9` |
| `GOOGLE_WORKDAY_END` | No | Hour (0–23), default `17` |
| `GOOGLE_AVAILABILITY_DAYS` | No | Days ahead to offer, default `21` |

Restart the Next.js app after changing env vars.

## 6. Without Google (degraded mode)

If the three required variables are missing, athletes still see **weekday time slots** (manual list). You can approve requests and add Zoom links; calendar events are **not** created until Google is connected.

## 7. Verify

1. Admin → **Check-in requests** — banner should say “Google Calendar connected”.
2. Athlete → **Book a call** — slots should say “live” from calendar when free/busy works.
3. Approve a request → event appears on Jethro’s Google Calendar; athlete gets calendar link when applicable.

## Security

- Never commit `.env` or refresh tokens to git.
- Rotate the refresh token if it is exposed.
- Use a dedicated Google Cloud project for production.
