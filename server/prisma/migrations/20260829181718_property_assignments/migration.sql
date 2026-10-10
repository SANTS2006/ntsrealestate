-- CreateTable
CREATE TABLE "property_assignments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "property_assignments_organization_id_idx" ON "property_assignments"("organization_id");

-- CreateIndex
CREATE INDEX "property_assignments_user_id_idx" ON "property_assignments"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "property_assignments_property_id_user_id_key" ON "property_assignments"("property_id", "user_id");

-- AddForeignKey
ALTER TABLE "property_assignments" ADD CONSTRAINT "property_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_assignments" ADD CONSTRAINT "property_assignments_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_assignments" ADD CONSTRAINT "property_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

