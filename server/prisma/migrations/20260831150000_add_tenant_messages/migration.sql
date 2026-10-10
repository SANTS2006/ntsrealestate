-- CreateTable
CREATE TABLE "tenant_messages" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenant_messages_organization_id_idx" ON "tenant_messages"("organization_id");

-- CreateIndex
CREATE INDEX "tenant_messages_tenant_id_idx" ON "tenant_messages"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_messages_recipient_id_idx" ON "tenant_messages"("recipient_id");

-- AddForeignKey
ALTER TABLE "tenant_messages" ADD CONSTRAINT "tenant_messages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_messages" ADD CONSTRAINT "tenant_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_messages" ADD CONSTRAINT "tenant_messages_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_messages" ADD CONSTRAINT "tenant_messages_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
