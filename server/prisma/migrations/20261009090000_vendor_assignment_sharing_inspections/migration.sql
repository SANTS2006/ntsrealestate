-- A maintenance request is assigned to a vendor.
ALTER TABLE "maintenance_requests" ADD COLUMN "vendor_id" UUID;
CREATE INDEX "maintenance_requests_vendor_id_idx" ON "maintenance_requests"("vendor_id");
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A property, building or unit registered as shared can be rented by more
-- than one person; anything else goes to one renter only.
ALTER TABLE "properties" ADD COLUMN "is_shared" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "buildings" ADD COLUMN "is_shared" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "units" ADD COLUMN "is_shared" BOOLEAN NOT NULL DEFAULT false;

-- An inspection can be for a whole property, a building, or a unit.
ALTER TABLE "inspections" ADD COLUMN "building_id" UUID;
CREATE INDEX "inspections_building_id_idx" ON "inspections"("building_id");
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
