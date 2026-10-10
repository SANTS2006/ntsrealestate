-- Business rule: a unit cannot have more than one simultaneously-active lease.
-- Enforced at the database level (in addition to the service-layer transaction
-- check) via a partial unique index, since Prisma's schema DSL cannot express
-- a WHERE predicate on @@unique.
CREATE UNIQUE INDEX "leases_unit_id_active_unique" ON "leases" ("unit_id") WHERE "status" = 'active';
