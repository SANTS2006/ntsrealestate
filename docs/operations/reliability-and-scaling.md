# Reliability, scaling and the blank-page fix

## Architecture in one paragraph

One Node/Express API (`server/`) serves JSON under `/api/v1` and, in production, the built React app (`client/dist`) from the same origin. State lives in Neon Postgres (Prisma through the Neon serverless pool; sessions in the same database via `connect-pg-simple`). Browser auth is an HttpOnly session cookie plus a double-submit CSRF header; there are no browser access/refresh tokens (JWT exists only for non-browser clients), so there is no token-refresh race in the web app. Roles/permissions are enforced on the server (`requirePermission`, resource scope checks); the front end only hides things. Realtime chat uses Socket.IO on the same server.

## The blank page — root causes and fixes

**Symptom:** clicking some pages shows a blank page; a manual refresh fixes it.

Every page is a lazily loaded chunk (`React.lazy`). Four defects combined:

1. **No error boundary anywhere.** If a lazy import rejected or any component threw while rendering, React unmounted the whole tree → blank white screen. → `ErrorBoundary` at the app root and around each layout's page area (reset on navigation), with "Try again / Reload / Dashboard".
2. **A failed import was cached for the life of the page.** `React.lazy` remembers the rejection, so every later click on that route stayed broken until refresh (which is why refresh "fixed" it). → `lazyWithRetry`: retries the import, then (new deploy detected) reloads **once**, guarded by `sessionStorage` + a 60 s cooldown so it can never loop; "Try again" drops the cached failure and re-imports.
3. **Old chunk URLs answered with `index.html`.** After a deploy the old hashed files are gone; the SPA fallback replied `200 text/html` for `/assets/Page-abc.js`, so the browser tried to run HTML as JavaScript (module/MIME error → chunk failure). → missing `/assets/*` and other file-like URLs now return a real `404`; the fallback is only for page routes.
4. **The service worker could pin the bad answer.** It cache-first stored any `200` under `/assets/`, including that HTML. → it now refuses to cache `text/html` as an asset; cache version bumped so existing poisoned caches are discarded.

Also: `index.html`, `sw.js` and the manifest are served `no-cache`; fingerprinted `/assets/*` are `immutable, max-age=1y`. So a visit always gets the current entry file, and assets stay cached.

Related hardening:

* **Auth start-up state is explicit** (`initializing | authenticated | unauthenticated | error`). Previously a network blip during `/auth/me` looked like "signed out" and bounced people to login. Now `error` shows "We could not reach the server — Try again" and keeps the session.
* **Expired sessions:** any API `401` (outside the auth calls) fires `auth:expired`; the context clears the user once and the route guard redirects to the company login. No page is left showing failed requests.
* **Global handlers** report `error`, `unhandledrejection` and `vite:preloadError` to `POST /api/v1/client-errors` (rate-limited, size-capped, log-only), so these failures are visible in server logs.
* The API client already had a 30 s timeout and retries GETs on network/502/503/504; writes are never auto-retried.
* `index.html` fallback verified for direct URLs: any non-API, non-file path gets `index.html`.

## Scaling and multiple instances

| Concern | State |
| --- | --- |
| Sessions | In Postgres — shared by all instances. |
| Rate limiting | `express-rate-limit` default **in-memory store**: limits are per instance (N instances ⇒ up to N× the limit). Move to a shared store (Redis/Postgres) when you run more than one instance. |
| Realtime (Socket.IO) | No adapter: with several instances a message reaches only sockets on the same instance. Needs `@socket.io/redis-adapter` (or sticky sessions + adapter) before scaling out. **Not done.** |
| Scheduled work | Backup scheduler is multi-instance safe (database-enforced single runner). |
| Temporary files | Backup/restore use the OS temp dir and delete it afterwards. |
| DB connections | `DATABASE_POOL_SIZE` (default 10) per instance, idle 30 s, connect timeout 15 s; sessions `SESSION_POOL_SIZE` (5). Size so *instances × (pool+session+1 backup)* stays under the database limit; use the pooled URL (`DATABASE_URL`). |
| Timeouts | `requestTimeout` 120 s, `headersTimeout` 66 s, `keepAliveTimeout` 65 s on the HTTP server. |
| Shutdown | SIGTERM/SIGINT: stop scheduler, stop accepting, close idle connections, then close DB and session pools; forced exit after 10 s. |
| Limits | JSON body 1 MB; uploads via Multer limits; pagination helper caps page size (`parsePagination`). |

## Concurrency and consistency

* **Idempotency:** the browser sends an `Idempotency-Key` on writes; an identical write within 8 s reuses the key (double-click). Server middleware stores the first successful response per `(user, key)` in `idempotency_keys` (unique index) and replays it; simultaneous duplicates get `409 REQUEST_IN_PROGRESS`; failed attempts are forgotten so a corrected retry works; a different body under a used key is `422`. Keys expire after 24 h. Payments additionally keep their own `idempotency_key` unique column.
* **Rentals:** the place's row is locked (`SELECT … FOR UPDATE`) and re-checked inside the transaction, so of many simultaneous renters exactly one wins.
* **Deal payments:** the deal row is locked and "amount still owed" re-checked inside the transaction (previously a check-then-insert race that could overpay).
* **Invoice payments:** already atomic (`increment` + balance check in one transaction).
* **Refunds:** the `completed → refunded` flip is a conditional update; only the request that flips it reverses the invoice, so concurrent refunds cannot double-reverse.
* **Backups/restores:** one running at a time enforced by partial unique indexes.
* Tests: `tests/integration/server/concurrency.test.js`, `idempotency.test.js`, `backup-service.test.js`.

## Errors and logging

Every response carries `X-Request-Id`; error bodies are `{success:false, error:{code,message,details?}, requestId}`. Validation `422`, auth `401`, permission `403`, missing `404`, conflict `409`, rate limit `429`, unexpected `500` (no stack traces outside development). `pino` logs each request with the id; the platform audit log records backup/restore and admin actions. Passwords, tokens and keys are not logged (Prisma query logging is development only).

## Migrations

`prisma migrate deploy` runs in the Render build. Migrations in this project are additive (new tables/columns/indexes). For destructive changes: add the new shape first, deploy code that writes both, backfill, switch reads, and drop the old shape in a later release — and take a manual backup first.

## Monitoring and troubleshooting

* `GET /api/v1/health/live` (process) and `/api/v1/health` (database). Alert on `/health` ≠ 200 and on **Backup & recovery → status ≠ healthy**.
* Search logs by `requestId`. Browser crashes appear as `browser error report`.
* "Page blank after a deploy" → should no longer occur; if a report arrives, look for `browser error report` with `kind: chunk`.
* "Database timeouts" → check pool size vs. the database connection limit, and long-running queries.

## Not covered / honest limits

* Socket.IO and rate-limit state are per instance (above).
* Not every list endpoint has been reviewed for N+1 patterns or index fit; hot paths seen (properties, units, rentals, payments) use indexed filters. Add indexes from real slow-query data, not guesses.
* No load balancer or APM exists in the repo; load figures in the report come from the throwaway-organisation tests only.
