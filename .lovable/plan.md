
# WhatsApp DSC Signing App — Build Plan

A single-user internal tool that signs PDFs with eMudhra DSC + RFC 3161 timestamp, optionally password-protects them, and delivers via a personal WhatsApp number — usable manually, in bulk, or via a public `/v1/send` API for your other internal apps (SmartCare, hosting CRM, SmartSchool).

This Lovable app owns the UI, schema, settings, and the public API. A separate always-on Node.js sidecar (scaffolded as stubs) holds the live WhatsApp connection and runs the signing worker — it can't live in serverless because WhatsApp needs a persistent socket.

## Build order

### 1. Backend foundation (one migration)
- All 10 tables from your spec, with the GRANTs required for the Data API.
- RLS:
  - `emudhra_credentials`, `api_keys`, `whatsapp_sessions` → no client policies (service-role only, RLS forces zero anon/authenticated access).
  - `audit_log` → INSERT for authenticated/service, no UPDATE/DELETE policy (insert-only).
  - All other tables → authenticated full access (single-user tool).
- Seed singleton rows for `connection_status`, `system_health`, `settings` (id=1).
- `pgsodium` / Vault wrapping for `emudhra_credentials.api_secret` via a secret stored in Vault; getter/setter SQL functions called from server functions only.
- Realtime: enable on `connection_status`, `outbox`, `system_health`.
- `hash_api_key(text)` SQL helper (sha256 hex) so we never store raw keys.

### 2. Auth
- Email/password sign-in only (single-user, no signup form, no Google — you don't want SSO).
- `/auth` route, then a `_authenticated/` layout gating everything else.
- Note on `/settings/security` reminding you to enable TOTP MFA in the Cloud dashboard.

### 3. Design system (`src/styles.css`)
- Tokens: `--canvas` `#FAF9F6`, `--ink` `#1A1F1C`, `--surface`, brand green `#25D366`, teal `#075E54`, status blue/amber/red, plus glow colors as soft layered radial gradients.
- Fonts loaded via `<link>` in `__root.tsx`: Space Grotesk (display), Inter (body), JetBrains Mono (data).
- Custom `.glass-card` utility (one place: connect screen) with backdrop-blur, gradient border, two-layer shadow.
- Custom `.status-badge-*`, `.data-mono`, hover lift, cursor-following radial highlight on dashboard cards.
- `prefers-reduced-motion` overrides for the connect-screen pulse.

### 4. Layout shell
- Sidebar nav: Connect, Dashboard, Send, Templates, Verify, Logs, API Keys, Health, Settings.
- Sign-out button, connection-status pill in header (live).

### 5. Pages (all real data, no mocks)
- `/connect` — glass QR card, Realtime-subscribed to `connection_status`. Pulsing green ring while awaiting scan, orchestrated success animation on `connected`. Force reconnect button calls a server fn that writes `status='disconnected'` (sidecar picks up). Auto-redirect to `/dashboard` on connect.
- `/dashboard` — flat surface cards: connection summary (glass strip), today's sent/delivered/read counts (aggregate query on `outbox`), eMudhra circuit-breaker state, sidecar heartbeat age (red banner if >2min), queue depth, recent 10 outbox rows.
- `/settings/security` — lock-PDFs toggle, password-rule dropdown (last4/fixed/custom), eMudhra enable + masked API key/secret fields (writes through server fn using Vault), key-rotation age badge, MFA reminder.
- `/templates` — list, create, edit. Editing creates a new `version` row (version = max+1, old marked inactive). Static PDF (file upload to Storage bucket `templates`) or merge-fields template with JSONB field schema editor.
- `/send` — tabs: Single (phone, template/PDF, merge values, password override), Bulk (CSV upload, map columns to template fields, preview, batch insert). Both insert `outbox` rows with `status='queued'`, sidecar picks up. Live per-row status via Realtime.
- `/verify` — paste outbox ID or signed PDF SHA-256; shows signed date, signature presence, timestamp token presence, delivery status.
- `/api-keys` — list issued keys, create (shows raw key ONCE), revoke. Stores only `key_hash`.
- `/logs` — outbox + audit_log filterable views, source/status/date filters, JetBrains Mono for IDs/hashes/timestamps.
- `/health` — circuit-breaker state + consecutive failure count + sidecar heartbeat freshness, with red banner if stale.

### 6. Public API
- Server route `src/routes/api/public/v1/send.ts` accepting `x-api-key` header.
- Hashes the key with sha256 → lookup `api_keys.key_hash` (service-role load inside handler).
- On match: validate body with zod, insert `outbox` row using key's label as `source`, increment `total_documents_sent`, update `last_used_at`. Return `{ id, status: "queued" }`.
- Idempotency: `idempotency_key` unique constraint → on conflict return existing row id.

### 7. Sidecar scaffold (`/sidecar/`)
All TODO stub files per your spec, plus a `README.md` explaining:
- Deploy as an always-on Node service (Render / Fly / your own VPS).
- Required env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `EMUDHRA_API_BASE`, `TSA_URL`.
- Until deployed, `/connect` will sit at `awaiting_qr` and `outbox` rows will stay `queued` — that is correct behaviour.

## Out of scope (per your spec)
- Multi-tenant, billing, signup, SSO, demo seed data, mock states.
- Actual eMudhra HTTP call and actual Baileys socket — those live in the sidecar stubs.

## Technical notes
- Realtime subscriptions in `useEffect` with `removeChannel` cleanup (avoid reconnection loops).
- Public API route lives under `/api/public/v1/` so it bypasses auth at the edge; security is enforced in-handler via hashed key compare.
- `idempotency_key` is `UNIQUE` so concurrent retries from your other apps collapse to one outbox row.
- All admin/service-role code loaded inside handlers via `await import("@/integrations/supabase/client.server")` — never at module scope of route files.

## Confirm before I build
1. **Auth method:** email/password only (no Google, no signup form — I create your user once via SQL)? Or do you want a signup form too?
2. **Storage:** OK to create two Storage buckets — `templates` (private, signed URLs) and `signed-pdfs` (private, signed URLs)?
3. **eMudhra secret encryption:** Vault/pgsodium adds real complexity. Acceptable alternative: store in a runtime secret (`EMUDHRA_API_KEY`, `EMUDHRA_API_SECRET`) and skip the DB column entirely — simpler, equally secure, and the sidecar reads them from env directly. Which do you prefer?
4. **Anything I should defer to a follow-up turn** to keep this first build focused (e.g. bulk CSV send, verify page)?

Reply with answers (or "go with defaults: email-only auth, both buckets, runtime secrets, build everything") and I'll execute.
