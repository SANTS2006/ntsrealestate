-- Rent / buy / lease offers on a unit, lands for sale, the deals people make
-- (renting, buying or leasing a house, buying land), payments against deals,
-- and platform-wide settings (maintenance mode).

CREATE TYPE "DealKind" AS ENUM ('rent', 'buy', 'lease');
CREATE TYPE "DealStatus" AS ENUM ('pending', 'approved', 'completed', 'cancelled');
CREATE TYPE "LandStatus" AS ENUM ('available', 'reserved', 'sold', 'unavailable');

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'deal_request';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'deal_update';

ALTER TABLE "units"
  ADD COLUMN "offer_rent" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "offer_sale" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "offer_lease" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sale_price" DECIMAL(14,2),
  ADD COLUMN "lease_price" DECIMAL(14,2),
  ADD COLUMN "lease_term_months" INTEGER;

CREATE TABLE "lands" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "owner_id" UUID,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "land_type" TEXT NOT NULL DEFAULT 'residential',
  "area" DECIMAL(14,2) NOT NULL,
  "area_unit" TEXT NOT NULL DEFAULT 'acres',
  "price" DECIMAL(14,2) NOT NULL,
  "address" TEXT,
  "city" TEXT,
  "region" TEXT,
  "country" TEXT,
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "title_document" TEXT,
  "features" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "LandStatus" NOT NULL DEFAULT 'available',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lands_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "lands_organization_id_idx" ON "lands"("organization_id");
CREATE INDEX "lands_status_idx" ON "lands"("status");
ALTER TABLE "lands" ADD CONSTRAINT "lands_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lands" ADD CONSTRAINT "lands_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "deals" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "kind" "DealKind" NOT NULL,
  "status" "DealStatus" NOT NULL DEFAULT 'pending',
  "tenant_id" UUID NOT NULL,
  "unit_id" UUID,
  "land_id" UUID,
  "property_id" UUID,
  "owner_id" UUID,
  "lease_id" UUID,
  "price" DECIMAL(14,2) NOT NULL,
  "term_months" INTEGER,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "deals_organization_id_idx" ON "deals"("organization_id");
CREATE INDEX "deals_tenant_id_idx" ON "deals"("tenant_id");
CREATE INDEX "deals_property_id_idx" ON "deals"("property_id");
CREATE INDEX "deals_owner_id_idx" ON "deals"("owner_id");
CREATE INDEX "deals_kind_status_idx" ON "deals"("kind", "status");
ALTER TABLE "deals" ADD CONSTRAINT "deals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deals" ADD CONSTRAINT "deals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deals" ADD CONSTRAINT "deals_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "deals" ADD CONSTRAINT "deals_land_id_fkey" FOREIGN KEY ("land_id") REFERENCES "lands"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "deals" ADD CONSTRAINT "deals_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payments" ADD COLUMN "deal_id" UUID;
CREATE INDEX "payments_deal_id_idx" ON "payments"("deal_id");
ALTER TABLE "payments" ADD CONSTRAINT "payments_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "platform_settings" (
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL DEFAULT '{}',
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);
