-- How a property is organised: one whole rentable property, buildings that are
-- each rented as a whole, buildings with units, or units directly in the property.
CREATE TYPE "PropertyStructure" AS ENUM ('whole', 'buildings', 'buildings_units', 'units');

ALTER TABLE "properties"
  ADD COLUMN "structure_type" "PropertyStructure" NOT NULL DEFAULT 'buildings_units',
  ADD COLUMN "amenities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- A building the system created for a property that has no real buildings
-- (a whole property, or units placed directly in the property).
ALTER TABLE "buildings" ADD COLUMN "is_implicit" BOOLEAN NOT NULL DEFAULT false;

-- A unit that stands for the whole property / whole building.
ALTER TABLE "units"
  ADD COLUMN "is_whole" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "furnished" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "amenities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
