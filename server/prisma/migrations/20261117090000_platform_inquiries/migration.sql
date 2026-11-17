-- Contact messages and demo requests from the public marketing website.
-- Additive only: one new table, no foreign keys.

CREATE TABLE "platform_inquiries" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "kind"           TEXT NOT NULL,                  -- contact | demo
  "status"         TEXT NOT NULL DEFAULT 'new',    -- new | read | replied | archived
  "name"           TEXT NOT NULL,
  "email"          TEXT NOT NULL,
  "phone"          TEXT,
  "company"        TEXT,
  "interest"       TEXT,
  "portfolio_size" TEXT,
  "message"        TEXT,
  "source"         TEXT,
  "ip_address"     TEXT,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "platform_inquiries_status_created_at_idx" ON "platform_inquiries" ("status", "created_at");
CREATE INDEX "platform_inquiries_kind_idx" ON "platform_inquiries" ("kind");
