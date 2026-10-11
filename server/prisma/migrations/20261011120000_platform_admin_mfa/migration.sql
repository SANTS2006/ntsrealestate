-- Two-factor authentication (authenticator app + recovery codes) for platform admins.
ALTER TABLE "platform_admins" ADD COLUMN "mfa_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "platform_admins" ADD COLUMN "mfa_secret_encrypted" TEXT;

CREATE TABLE "platform_admin_recovery_codes" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "platform_admin_id" UUID NOT NULL REFERENCES "platform_admins"("id") ON DELETE CASCADE,
  "code_hash"         TEXT NOT NULL,
  "used_at"           TIMESTAMPTZ,
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "platform_admin_recovery_codes_admin_idx" ON "platform_admin_recovery_codes" ("platform_admin_id");
