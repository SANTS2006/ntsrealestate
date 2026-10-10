-- Backup & Recovery bookkeeping and request idempotency.
-- Additive only: new tables, no changes to existing ones. No foreign keys on
-- the backup tables on purpose, so a restore can never cascade into them.

CREATE TABLE "backups" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "type"              TEXT NOT NULL,                      -- AUTOMATIC | MANUAL | PRE_RESTORE
  "status"            TEXT NOT NULL DEFAULT 'PENDING',    -- PENDING | RUNNING | COMPLETED | FAILED | DELETED
  "verification"      TEXT NOT NULL DEFAULT 'UNVERIFIED', -- UNVERIFIED | VERIFIED | FAILED
  "size_bytes"        BIGINT,
  "checksum_sha256"   TEXT,
  "encrypted"         BOOLEAN NOT NULL DEFAULT false,
  "storage_provider"  TEXT NOT NULL,
  "storage_key"       TEXT,
  "table_count"       INTEGER,
  "row_count"         INTEGER,
  "table_counts"      JSONB,
  "schema_migration"  TEXT,
  "created_by_id"     UUID,
  "created_by_name"   TEXT,
  "error_message"     TEXT,
  "started_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "heartbeat_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completed_at"      TIMESTAMPTZ,
  "verified_at"       TIMESTAMPTZ,
  "deleted_at"        TIMESTAMPTZ,
  "request_id"        TEXT
);
CREATE INDEX "backups_started_at_idx" ON "backups" ("started_at" DESC);
CREATE INDEX "backups_status_idx" ON "backups" ("status");
-- At most one backup can be running at any time, across every server instance.
CREATE UNIQUE INDEX "backups_one_active" ON "backups" ((1)) WHERE "status" IN ('PENDING', 'RUNNING');

CREATE TABLE "backup_restores" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "backup_id"           UUID NOT NULL,
  "safety_backup_id"    UUID,
  "status"              TEXT NOT NULL DEFAULT 'pending',
  "started_by_id"       UUID,
  "started_by_name"     TEXT,
  "backup_taken_at"     TIMESTAMPTZ,
  "error_message"       TEXT,
  "rolled_back"         BOOLEAN NOT NULL DEFAULT false,
  "verification"        JSONB,
  "started_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "heartbeat_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completed_at"        TIMESTAMPTZ,
  "request_id"          TEXT
);
CREATE INDEX "backup_restores_started_at_idx" ON "backup_restores" ("started_at" DESC);
-- Only one restore at a time.
CREATE UNIQUE INDEX "backup_restores_one_active" ON "backup_restores" ((1)) WHERE "status" NOT IN ('completed', 'failed');

-- A repeated request (double click, retry after a timeout) with the same key
-- returns the first response instead of doing the work twice.
CREATE TABLE "idempotency_keys" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "key"           TEXT NOT NULL,
  "scope"         TEXT NOT NULL,         -- who: user:<id>
  "method"        TEXT NOT NULL,
  "path"          TEXT NOT NULL,
  "request_hash"  TEXT NOT NULL,
  "status_code"   INTEGER,
  "response_body" JSONB,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completed_at"  TIMESTAMPTZ
);
CREATE UNIQUE INDEX "idempotency_keys_scope_key" ON "idempotency_keys" ("scope", "key");
CREATE INDEX "idempotency_keys_created_at_idx" ON "idempotency_keys" ("created_at");
