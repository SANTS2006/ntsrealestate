-- Profile pictures for platform admins. The image bytes live in their own
-- table so the admin row (read on every request) stays small.
ALTER TABLE "platform_admins" ADD COLUMN "avatar_updated_at" TIMESTAMPTZ;

CREATE TABLE "platform_admin_avatars" (
  "platform_admin_id" UUID PRIMARY KEY REFERENCES "platform_admins"("id") ON DELETE CASCADE,
  "mime_type"         TEXT NOT NULL,
  "data"              BYTEA NOT NULL,
  "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now()
);
