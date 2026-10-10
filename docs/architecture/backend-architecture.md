# Backend Architecture

## Layout (`server/src`)

```
auth/            — password hashing, TOTP, token issuance/verification helpers (Phase 4)
config/          — env.js, database.js, logger.js, session.js (all config in one place)
controllers/     — thin HTTP-layer orchestration; no Prisma imports, no business logic
middleware/      — security.js, csrf.js, errorHandler.js, auth.js, authorize.js (Phase 4/5)
repositories/    — the only layer importing PrismaClient; every fn takes organizationId
routes/v1/       — one file per resource, mounted in routes/v1/index.js
services/        — business logic + transactions; the only layer allowed to call
                   multiple repositories or external integrations together
validators/      — Zod schemas per resource, shared between create/update where sensible
utils/           — AppError, apiResponse, asyncHandler — no business logic
jobs/            — background/retry tasks (e.g. Cloudinary cleanup retry, invoice generation)
integrations/    — cloudinary/, email/, jwt/ — the only code that imports third-party SDKs
```

## Why this layering

- A bug that skips authorization can only happen in `middleware/` or `services/` — never
  silently in a `controller` that forgot to check, because controllers don't have direct
  DB access to "just get the data anyway."
- `repositories/` being the sole Prisma import point makes the organization-scoping
  convention (§4 of authorization.md) mechanically checkable: grep for `prisma.` outside
  `repositories/` should return nothing.
- `services/` owning transactions means multi-step operations (create lease → update unit
  status → generate invoice schedule → audit log) either fully succeed or fully roll back —
  see the Lease creation flow as the canonical example once Phase 7 lands.

## Adding a new resource (pattern to follow in every later phase)

1. `prisma/schema.prisma` — model already exists (Phase 1); if not, add + migrate.
2. `validators/<resource>.validators.js` — Zod schemas for create/update/query.
3. `repositories/<resource>.repository.js` — `findById(id, organizationId)`,
   `findMany(filters, organizationId)`, `create(data, organizationId)`, `update(...)`.
4. `services/<resource>.service.js` — authorization-aware business logic, transactions,
   audit logging, notification triggers.
5. `controllers/<resource>.controller.js` — parse request → call service → `sendSuccess`.
6. `routes/v1/<resource>.routes.js` — wire auth + authorize + validate + controller;
   mount in `routes/v1/index.js`.
7. `tests/unit` + `tests/integration` for the new service/route.
