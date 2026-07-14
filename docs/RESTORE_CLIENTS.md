# Restore ops clients after accidental wipe

The wipe script removed **2 clients** (and linked commercial profiles) from Neon. That data is **not** in the git repo — it only lived in Postgres.

## Option A — Neon point-in-time restore (recommended)

Neon keeps history you can branch from.

1. Open [Neon Console](https://console.neon.tech) → your Blocharch project.
2. **Branches** → **Create branch** → **Point in time**.
3. Pick a timestamp **before** the wipe (e.g. a few hours earlier on the day you ran `wipe-db-keep-admins.mjs`).
4. Copy the new branch **connection string**.
5. In `.env` (or PowerShell for one run):

   ```env
   RESTORE_DATABASE_URL=postgresql://...branch-connection-string...
   DATABASE_URL=postgresql://...main-branch-connection-string...
   ```

6. Restore clients into live DB:

   ```bash
   node scripts/restore-ops-from-neon-pitr.mjs --confirm
   ```

7. Delete the temporary branch in Neon when done.

## Option B — JSON export you already have

If you exported clients earlier:

```bash
node scripts/restore-ops-clients.mjs data/ops-clients.export.json --confirm
```

Create an export from a PITR branch first:

```bash
set RESTORE_DATABASE_URL=postgresql://...pitr-branch...
node scripts/export-ops-clients.mjs data/ops-clients.export.json
```

## Option C — Re-enter manually

Ops → **Clients** → **Add client**, or use the API/UI if PITR is unavailable.

## Prevent next time

When clearing test data but keeping clients:

```bash
node scripts/wipe-db-keep-admins.mjs --confirm --keep-clients
```
