# System Architecture — NTS Real Estate System

## 1. Overview

NTS Real Estate System is a multi-tenant (organization-scoped) real estate management platform. Each
`organization` is a tenant boundary — property management companies, each with their own
users, properties, tenants, leases, and financial records. The architecture is designed to
evolve into a full SaaS product without a rewrite.

## 2. High-Level Topology

```
React (Vite) SPA  ──HTTPS──>  Express REST API (/api/v1)  ──>  Neon PostgreSQL (pooled)
                                       │
                                       └──>  Cloudinary (media/documents, server-signed)
                                       │
                                       └──>  SMTP provider (transactional email)
```

No Docker, no local database, no local production file storage. Every stateful dependency
(Postgres, file storage) is an external managed service reached over the network via
official SDKs/drivers, using credentials supplied only through environment variables.

## 3. Request Flow (standard)

```
HTTP Request
  → Helmet / CORS / rate limiter (global middleware)
  → Request-ID + structured logger
  → Body parsing + size limits
  → Authentication middleware (session OR JWT, route-dependent)
  → Authorization middleware (role + permission + org scope + ownership)
  → Zod validation middleware (body/query/params)
  → Controller (thin — orchestration only)
  → Service (business logic, transactions)
  → Repository (Prisma queries, always org-scoped)
  → Neon PostgreSQL
  ← Centralized error handler (uniform JSON envelope, no leaked internals)
```

## 4. Request Flow (file upload)

```
HTTP Request (multipart, size-limited)
  → Auth + Authorization (who / which org / which entity / which permission)
  → Multer (memory storage, size + count limits — never disk)
  → File validation (extension allow-list, MIME sniffing via file-type magic bytes)
  → Upload service → Cloudinary (resource_type inferred from validated content;
    private/authenticated delivery for sensitive documents)
  → documents table row (metadata only — no file bytes in Postgres)
  → Audit log entry
```

## 5. Layering Rules

- **Controllers** never talk to Prisma directly — only to services.
- **Services** own transactions, business rules, and orchestration across repositories.
- **Repositories** are the only layer that imports the Prisma client; every query that
  touches an organization-owned table takes `organizationId` as a mandatory parameter.
- Cross-cutting concerns (audit logging, notifications) are invoked from services, not
  controllers, so they can't be bypassed by a new route.

## 6. Environments

| Concern       | Technology                                    |
|---------------|------------------------------------------------|
| Frontend host | Vercel (or any static/edge host) — not fixed   |
| API host      | Render / Railway / Fly.io — not fixed          |
| Database      | Neon PostgreSQL (serverless, pooled)           |
| File storage  | Cloudinary                                     |
| Email         | SMTP via Nodemailer (provider-agnostic)        |
| Sessions      | PostgreSQL-backed (`connect-pg-simple`), not Redis, not memory |

Redis is explicitly **not** introduced until there's a measured need (see
[Session Architecture](../security/authentication.md)).

## 7. Roadmap

See the repository root [README.md](../../README.md#development-roadmap) for the phased
build plan (Phase 1 → Phase 17) this project follows.
