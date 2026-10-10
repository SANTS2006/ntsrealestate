# NTS Real Estate System

A production-grade, multi-tenant real estate management platform: properties, buildings,
units, owners, tenants, leases, invoicing, payments, expenses, maintenance, vendors,
inspections, documents, notifications, reports, and audit logging — built for a real
property management company, not a demo.

## Technology stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, React Router, Tailwind CSS, Lucide icons, React Hook Form + Zod, Axios, Recharts, Zustand (sparingly) |
| Backend | Node.js + Express (ESM), Zod validation, Helmet, CORS, rate limiting, Pino structured logging |
| Database | **Neon PostgreSQL** via **Prisma** (`@prisma/adapter-neon`) — no Docker, no local Postgres, no SQLite |
| File storage | **Cloudinary** (private/authenticated delivery for sensitive documents) — no local filesystem storage |
| Sessions | Postgres-backed (`connect-pg-simple`), HttpOnly/Secure/SameSite cookies — no Redis, no `localStorage` |
| Auth | Hybrid: server-side sessions for the browser app, JWT for mobile/external API clients |

See [docs/architecture/system-architecture.md](docs/architecture/system-architecture.md) for
the full picture and [docs/security/](docs/security/) for the security design.

## Project structure

```
client/    React/Vite SPA
server/    Express API (ESM), Prisma schema + client
database/  seeds/ (dev-only fixtures) — migrations live in server/prisma/migrations
docs/      architecture, database, security, api documentation
tests/     unit, integration, security, e2e
```

## Prerequisites

- Node.js ≥ 20
- A [Neon](https://neon.tech) PostgreSQL project (free tier is enough for development) —
  copy both its **pooled** and **direct** connection strings
- A [Cloudinary](https://cloudinary.com) account — cloud name, API key, API secret

No Docker, no local database server, and no local file storage server are required or used
anywhere in this project.

## Setup

```bash
npm install                       # installs client + server workspaces

cp server/.env.example server/.env
cp client/.env.example client/.env
# edit server/.env: DATABASE_URL / DIRECT_URL (from Neon), SESSION_SECRET,
# JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, CLOUDINARY_*, CORS_ORIGINS

npm run prisma:generate           # generate the Prisma client
cd server && npx prisma migrate dev --name init && cd ..
                                   # applies the schema to your Neon database
```

## Development

```bash
npm run dev            # runs the API (port 5000) and the client (port 5173) together
npm run dev:server      # API only
npm run dev:client      # client only
```

Visit `http://localhost:5173` — the landing page live-checks API connectivity and Neon
database reachability. `GET http://localhost:5000/api/v1/health` reports readiness without
leaking any credentials or internal detail.

## Database

- Schema: [server/prisma/schema.prisma](server/prisma/schema.prisma)
- Design rationale: [docs/database/database-design.md](docs/database/database-design.md)
- Migration workflow: [docs/database/migrations.md](docs/database/migrations.md)
- `npm run prisma:migrate` — create/apply a migration (dev)
- `npx prisma studio` (from `server/`) — browse data during development

## Testing

```bash
npm test                          # server + client test suites (112 server tests)
npm run test:unit --workspace server         # 41 tests, no network — fast
npm run test:integration --workspace server  # Supertest against the real app + live Neon DB
npm run test:security --workspace server     # IDOR/BOLA, CSRF, injection, JWT attacks, etc.
```

Test suites live under `tests/unit`, `tests/integration`, `tests/security`, `tests/e2e` at
the repo root (see `server/vitest.config.js` for how the server workspace picks them up —
note the generous `testTimeout`/`hookTimeout`, since integration/security tests exercise the
real Express app in-process via Supertest against the actual live Neon database, not a
mock, and a multi-step flow can legitimately take 10+ seconds).

- **Unit** (41 tests, `tests/unit/server`) — Argon2id password hashing/policy, AES-256-GCM
  MFA secret encryption, JWT sign/verify, permission-catalog integrity, file-upload
  validation (magic-byte sniffing, content-type spoofing, filename sanitization).
- **Integration** (28 tests, `tests/integration/server`) — full auth flows (register/verify/
  login/MFA/JWT rotation/password reset) against the real request pipeline; organization
  isolation, RBAC, and resource-level (assignment/ownership) authorization; financial
  integrity (idempotent payments, over-payment rejection, refund reversal, void protection).
- **Security** (43 tests, `tests/security/server`) — cross-organization IDOR/BOLA across
  every core resource type; CSRF (missing/mismatched token, untrusted Origin); SQL
  injection and stored-payload safety; forged/tampered/`alg:none` JWTs; brute-force account
  lockout; mass-assignment attempts (unrecognized fields, cross-org smuggling, invalid
  roles); malicious file uploads (spoofed content, path traversal) and confirmation that
  uploaded assets are never publicly reachable.

Every test in `tests/integration` and `tests/security` runs against your actual configured
Neon database — there is no mocking layer — and cleans up everything it creates afterward
(`tests/integration/server/helpers/cleanup.js`, including destroying any Cloudinary assets
a test uploaded, so the suite never leaves orphaned files or database rows behind).
`tests/e2e` (browser-driven, against the frontend) is not yet started — see the roadmap.

## Security

Start with [docs/security/threat-model.md](docs/security/threat-model.md), then
[authentication.md](docs/security/authentication.md),
[authorization.md](docs/security/authorization.md), and
[cloudinary-security.md](docs/security/cloudinary-security.md). Security-relevant defaults
already in place: strict CORS allowlist (no wildcard), Helmet security headers, double-submit
CSRF protection, Postgres-backed sessions (HttpOnly/Secure/SameSite), rate limiting
(stricter on auth endpoints), env-var validation that fails fast on missing/weak secrets,
and a centralized error handler that never leaks internals in production.

**Never commit `.env`.** Only `.env.example` files are tracked.

## Development roadmap

| Phase | Scope | Status |
|---|---|---|
| 1 | Project foundation, architecture & security docs, folder structure | ✅ Done |
| 2 | Database schema (Neon + Prisma), migration strategy | ✅ Done |
| 3 | Express foundation: security middleware, logging, error handling, health checks | ✅ Done |
| 4 | Authentication: sessions, JWT, Argon2id, MFA, password reset/verification | ✅ Done |
| 5 | Authorization: RBAC enforcement, user/role/org management, self-restriction rules | ✅ Done |
| 6 | Cloudinary integration: upload service, magic-byte validation, authenticated document access | ✅ Done |
| 7 | Core modules: properties, buildings, units, owners, tenants, leases + resource-level authorization | ✅ Done |
| 8 | Finance: invoices, payments (idempotent, refundable), expenses (approval workflow), financial summary report | ✅ Done |
| 9 | Operations: maintenance requests, work orders, vendors, inspections | ✅ Done |
| 10 | Dashboard, reports (occupancy/rent-collection/maintenance), notifications, audit log viewer | ✅ Done |
| 11 | Automated test suite: unit, integration (Supertest against the real app + live Neon DB), security (IDOR/BOLA, CSRF, injection, JWT forgery, brute-force, mass assignment, malicious uploads) | ✅ Done |
| 12+ | Frontend build-out, performance review, production readiness, deployment prep | ⏳ Next |

## Deployment (no fixed provider mandated)

- Frontend: any static/edge host (e.g. Vercel)
- API: any Node host (e.g. Render, Railway, Fly.io)
- Database: Neon (already the dev database — no migration needed at deploy time)
- File storage: Cloudinary (already the dev storage — same account/config, different folder
  root by environment if desired)

No deployment has been performed as part of this repository — deployment readiness is
verified per environment variable and health-check requirements in
[docs/security/security-architecture.md](docs/security/security-architecture.md).
