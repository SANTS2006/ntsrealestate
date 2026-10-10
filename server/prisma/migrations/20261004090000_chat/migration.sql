-- CreateEnum
CREATE TYPE "ChatRoomType" AS ENUM ('community_tenants', 'community_staff', 'community_all', 'direct', 'support');

-- CreateTable
CREATE TABLE "chat_keys" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "platform_admin_id" UUID,
    "public_key" TEXT NOT NULL,
    "encrypted_private_key" TEXT NOT NULL,
    "key_salt" TEXT NOT NULL,
    "key_iv" TEXT NOT NULL,
    "kdf_iterations" INTEGER NOT NULL DEFAULT 250000,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "chat_keys_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chat_keys_one_owner" CHECK (("user_id" IS NOT NULL) <> ("platform_admin_id" IS NOT NULL))
);

CREATE TABLE "chat_rooms" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "type" "ChatRoomType" NOT NULL,
    "name" TEXT,
    "dedupe_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chat_members" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "user_id" UUID,
    "platform_admin_id" UUID,
    "wrapped_key" TEXT,
    "wrap_iv" TEXT,
    "wrapper_public_key" TEXT,
    "joined_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_read_at" TIMESTAMPTZ,
    CONSTRAINT "chat_members_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chat_members_one_person" CHECK (("user_id" IS NOT NULL) <> ("platform_admin_id" IS NOT NULL))
);

CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "sender_user_id" UUID,
    "sender_platform_admin_id" UUID,
    "ciphertext" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "attachment_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chat_messages_one_sender" CHECK (("sender_user_id" IS NOT NULL) <> ("sender_platform_admin_id" IS NOT NULL))
);

CREATE TABLE "chat_attachments" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "uploader_user_id" UUID,
    "uploader_platform_admin_id" UUID,
    "data" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chat_keys_user_id_key" ON "chat_keys"("user_id");
CREATE UNIQUE INDEX "chat_keys_platform_admin_id_key" ON "chat_keys"("platform_admin_id");
CREATE UNIQUE INDEX "chat_rooms_dedupe_key_key" ON "chat_rooms"("dedupe_key");
CREATE INDEX "chat_rooms_organization_id_idx" ON "chat_rooms"("organization_id");
CREATE UNIQUE INDEX "chat_members_room_id_user_id_key" ON "chat_members"("room_id", "user_id");
CREATE UNIQUE INDEX "chat_members_room_id_platform_admin_id_key" ON "chat_members"("room_id", "platform_admin_id");
CREATE INDEX "chat_members_user_id_idx" ON "chat_members"("user_id");
CREATE INDEX "chat_members_platform_admin_id_idx" ON "chat_members"("platform_admin_id");
CREATE UNIQUE INDEX "chat_messages_attachment_id_key" ON "chat_messages"("attachment_id");
CREATE INDEX "chat_messages_room_id_created_at_idx" ON "chat_messages"("room_id", "created_at");
CREATE INDEX "chat_attachments_room_id_idx" ON "chat_attachments"("room_id");

-- AddForeignKey
ALTER TABLE "chat_keys" ADD CONSTRAINT "chat_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_keys" ADD CONSTRAINT "chat_keys_platform_admin_id_fkey" FOREIGN KEY ("platform_admin_id") REFERENCES "platform_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_members" ADD CONSTRAINT "chat_members_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_members" ADD CONSTRAINT "chat_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_members" ADD CONSTRAINT "chat_members_platform_admin_id_fkey" FOREIGN KEY ("platform_admin_id") REFERENCES "platform_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_platform_admin_id_fkey" FOREIGN KEY ("sender_platform_admin_id") REFERENCES "platform_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "chat_attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "chat_attachments" ADD CONSTRAINT "chat_attachments_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_attachments" ADD CONSTRAINT "chat_attachments_uploader_user_id_fkey" FOREIGN KEY ("uploader_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_attachments" ADD CONSTRAINT "chat_attachments_uploader_platform_admin_id_fkey" FOREIGN KEY ("uploader_platform_admin_id") REFERENCES "platform_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
