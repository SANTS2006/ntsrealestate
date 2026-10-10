-- AlterTable
ALTER TABLE "platform_admins" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "platform_admin_password_reset_tokens" (
    "id" UUID NOT NULL,
    "platform_admin_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_admin_password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_admin_password_reset_tokens_token_hash_key" ON "platform_admin_password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "platform_admin_password_reset_tokens_platform_admin_id_idx" ON "platform_admin_password_reset_tokens"("platform_admin_id");

-- AddForeignKey
ALTER TABLE "platform_admin_password_reset_tokens" ADD CONSTRAINT "platform_admin_password_reset_tokens_platform_admin_id_fkey" FOREIGN KEY ("platform_admin_id") REFERENCES "platform_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
