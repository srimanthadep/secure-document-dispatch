# Signing Hub — Sidecar service

This folder is **NOT** part of the Lovable app. It is a separate always-on
Node.js process that holds the live WhatsApp connection (which cannot run
inside serverless functions — they cap at 150-400 seconds wall-clock and
cannot hold a socket open for hours) and runs the document-signing worker.

Deploy it anywhere that can run a long-lived Node process: Fly.io, Render,
Railway, a small VPS, your own machine. Restart-on-crash is mandatory.

## Required environment variables

```
SUPABASE_URL=...                  # same project as the Lovable app
SUPABASE_SERVICE_ROLE_KEY=...     # NEVER expose this anywhere else
EMUDHRA_API_BASE=...              # eMudhra signing endpoint
TSA_URL=...                       # RFC 3161 time stamping authority
SESSION_KEY_RETENTION=200         # max signal-key rows kept in whatsapp_sessions
CIRCUIT_THRESHOLD=5               # consecutive failures before circuit opens
HEARTBEAT_INTERVAL_MS=30000
```

## Stubs in this folder

Every file in this folder is a stub. Implement them in order:

1. `whatsapp.auth.js` — `usePostgresAuthState`: read/write Baileys creds and
   signal-key rows to `whatsapp_sessions`. Prune oldest rows beyond
   `SESSION_KEY_RETENTION` after every write.
2. `signing.service.js` — real eMudhra signing + RFC 3161 timestamping with
   circuit breaker (writes `system_health.emudhra_circuit_state`).
3. `whatsapp.worker.js` — long-poll `outbox WHERE status='queued'`, drive
   each row through signing → encrypting (if password) → sending. Retry with
   5s / 30s / 2min backoff. Subscribe to Baileys `messages.update` to write
   `delivered_at` / `read_at`.
4. `health.service.js` — write `connection_status.sidecar_last_heartbeat_at`
   every `HEARTBEAT_INTERVAL_MS` and expose `GET /health`.
5. `index.js` — entry point. Starts Baileys (which writes the QR string to
   `connection_status.qr_code` and flips `status` through awaiting_qr →
   connecting → connected), then starts the worker and heartbeat.

## Until you deploy it

- The `/connect` page will sit at "awaiting QR" forever. **That is correct.**
  The QR is published by the sidecar, not by the Lovable app.
- Rows inserted into `outbox` will stay at `status='queued'`. **That is correct.**
  The worker is the thing that moves them forward.

This is by design — the Lovable app is the brain (UI, schema, API, audit
trail); the sidecar is the hands (socket, signing, retries).
