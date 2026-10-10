-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'rental_request';

-- CreateEnum
CREATE TYPE "RentalStatus" AS ENUM ('active', 'ended');
CREATE TYPE "OwnerAgentStatus" AS ENUM ('active', 'inactive');

-- CreateTable
CREATE TABLE "tenant_rentals" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "building_id" UUID,
    "unit_id" UUID,
    "status" "RentalStatus" NOT NULL DEFAULT 'active',
    "source" TEXT NOT NULL DEFAULT 'staff',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ,
    CONSTRAINT "tenant_rentals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "owner_agents" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "agent_user_id" UUID NOT NULL,
    "status" "OwnerAgentStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "owner_agents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenant_rentals_organization_id_idx" ON "tenant_rentals"("organization_id");
CREATE INDEX "tenant_rentals_tenant_id_idx" ON "tenant_rentals"("tenant_id");
CREATE INDEX "tenant_rentals_property_id_idx" ON "tenant_rentals"("property_id");
CREATE INDEX "tenant_rentals_unit_id_idx" ON "tenant_rentals"("unit_id");
CREATE UNIQUE INDEX "owner_agents_owner_id_agent_user_id_key" ON "owner_agents"("owner_id", "agent_user_id");
CREATE INDEX "owner_agents_organization_id_idx" ON "owner_agents"("organization_id");
CREATE INDEX "owner_agents_agent_user_id_idx" ON "owner_agents"("agent_user_id");

-- AddForeignKey
ALTER TABLE "tenant_rentals" ADD CONSTRAINT "tenant_rentals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_rentals" ADD CONSTRAINT "tenant_rentals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_rentals" ADD CONSTRAINT "tenant_rentals_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_rentals" ADD CONSTRAINT "tenant_rentals_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_rentals" ADD CONSTRAINT "tenant_rentals_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "owner_agents" ADD CONSTRAINT "owner_agents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "owner_agents" ADD CONSTRAINT "owner_agents_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "owner_agents" ADD CONSTRAINT "owner_agents_agent_user_id_fkey" FOREIGN KEY ("agent_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every tenant that already has a building/unit gets it as a rental.
INSERT INTO "tenant_rentals" ("id", "organization_id", "tenant_id", "property_id", "building_id", "unit_id", "source")
SELECT gen_random_uuid(), t."organization_id", t."id",
       COALESCE(b."property_id", ub."property_id"), COALESCE(t."building_id", u."building_id"), t."unit_id", 'staff'
FROM "tenants" t
LEFT JOIN "buildings" b ON b."id" = t."building_id"
LEFT JOIN "units" u ON u."id" = t."unit_id"
LEFT JOIN "buildings" ub ON ub."id" = u."building_id"
WHERE t."building_id" IS NOT NULL OR t."unit_id" IS NOT NULL;
