# Migrations

## Workflow

```bash
# after editing server/prisma/schema.prisma
cd server
npx prisma migrate dev --name <short_description>   # local/dev, against DIRECT_URL
npx prisma generate                                   # regenerate the typed client
```

- `prisma migrate dev` requires the **direct** (non-pooled) Neon connection (`DIRECT_URL`)
  because it needs a session-mode connection — PgBouncer transaction pooling
  (`DATABASE_URL`) does not support the advisory locks Prisma's migration engine uses.
- Production deploys run `npx prisma migrate deploy` (no interactive prompts, no schema
  drift resolution — it only applies already-generated migration files).
- Generated migration SQL lives in `server/prisma/migrations/` and is committed to the repo;
  it is the single source of truth for schema history. Never hand-edit a migration that has
  already been applied anywhere (including only locally by another contributor) — create a
  new one instead.

## Generating migration SQL without an interactive terminal

`prisma migrate dev` refuses to run at all in a non-interactive shell (no TTY) — it exits
immediately with "environment is non-interactive." When that's the environment you're in,
generate the SQL with `prisma migrate diff` instead (non-interactive) and apply it via
`prisma migrate deploy`:

```bash
npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "<a disposable database, NEVER your real DATABASE_URL/DIRECT_URL>" \
  --script > prisma/migrations/<timestamp>_<name>/migration.sql
npx prisma migrate deploy
```

**`--shadow-database-url` must point at a separate, throwaway database — never the real
one.** Prisma treats the shadow database as disposable scratch space and resets it as part
of computing the diff. Pointing it at the actual `DATABASE_URL`/`DIRECT_URL` wipes all data
in that database (table *structure* is unaffected, since it gets rebuilt by replaying the
existing migrations — but every row is gone). This happened once during this project's own
development (recorded here so it isn't repeated): recovery was a `prisma migrate resolve
--applied <name>` for each already-applied migration to rebuild `_prisma_migrations`
tracking, followed by `prisma migrate deploy` for the new one. If no second database is
available, omitting `--shadow-database-url` and using `--from-empty` instead of
`--from-migrations` avoids touching any live database at all, at the cost of losing
drift-detection against migration history.

## Migrations that need raw SQL

Two rules Prisma's schema DSL can't express directly are added as raw-SQL steps inside a
generated migration (edit the generated `.sql` file before applying, not the schema):

1. Partial unique index preventing two simultaneously-active leases on one unit:
   ```sql
   CREATE UNIQUE INDEX leases_unit_id_active_unique
     ON leases (unit_id) WHERE status = 'active';
   ```
2. (Future, when RLS is enabled per `docs/security/authorization.md` §5) `ENABLE ROW LEVEL
   SECURITY` + `CREATE POLICY` statements per table.

## Seeding

`database/seeds/` contains development-only fixture data (see `docs/README` setup section).
Seeds are never run against a database where `NODE_ENV=production` — the seed script checks
this and exits immediately otherwise.
