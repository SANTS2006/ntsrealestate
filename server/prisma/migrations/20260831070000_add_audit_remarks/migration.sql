-- CreateTable
CREATE TABLE "audit_remarks" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_remarks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_remarks_organization_id_idx" ON "audit_remarks"("organization_id");

-- AddForeignKey
ALTER TABLE "audit_remarks" ADD CONSTRAINT "audit_remarks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_remarks" ADD CONSTRAINT "audit_remarks_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
