# Magizh Cafe – Temporary GitHub + Render Test Server

This package keeps the approved Magizh Cafe user/admin HTML design and adds a small temporary server-side storage layer for testing.

## Storage period
Default: **30 days**. Set `DATA_TTL_DAYS=15` in Render if you want 15 days instead.

The server automatically starts a fresh test store after the TTL expires.

## Run locally
```bash
npm install
npm start
```
Open:
- `/` – customer page
- `/admin` – admin page
- `/api/health` – health check

## Render
Use:
- Build Command: `npm install`
- Start Command: `npm start`
- Environment Variable: `DATA_TTL_DAYS=30` (or `15`)

## Important test note
This is a temporary test storage layer. It writes JSON to the server filesystem. On a Render service without persistent storage, a redeploy/restart can remove that file. This is intentional for the temporary test phase. When the main B5 server is ready, this layer can be replaced by the real central database/API without changing the approved UI.
