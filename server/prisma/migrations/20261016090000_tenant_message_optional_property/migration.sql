-- A tenant with no property yet can still message the administrators.
ALTER TABLE "tenant_messages" ALTER COLUMN "property_id" DROP NOT NULL;
