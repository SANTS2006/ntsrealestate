-- Optional "current residence" reference for a tenant, independent of
-- Lease history (see prisma/schema.prisma's Tenant model comment).
ALTER TABLE "tenants" ADD COLUMN "building_id" UUID,
ADD COLUMN "unit_id" UUID;

CREATE INDEX "tenants_building_id_idx" ON "tenants"("building_id");
CREATE INDEX "tenants_unit_id_idx" ON "tenants"("unit_id");

ALTER TABLE "tenants" ADD CONSTRAINT "tenants_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
