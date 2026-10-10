-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('pending', 'approved', 'paid');

-- New NotificationType values for the referral program (see
-- referral.service.js).
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'referral_used';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'referral_bonus_approved';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'referral_bonus_paid';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "referral_code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");

-- CreateTable
CREATE TABLE "referrals" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "referrer_id" UUID NOT NULL,
    "referred_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "bonus_amount" DECIMAL(14,2),
    "status" "ReferralStatus" NOT NULL DEFAULT 'pending',
    "paid_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "referrals_referred_id_key" ON "referrals"("referred_id");

-- CreateIndex
CREATE INDEX "referrals_organization_id_idx" ON "referrals"("organization_id");

-- CreateIndex
CREATE INDEX "referrals_referrer_id_idx" ON "referrals"("referrer_id");

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_id_fkey" FOREIGN KEY ("referred_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
