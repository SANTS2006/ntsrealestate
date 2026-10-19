-- Sign in with Google for platform admins: the linked Google account.
ALTER TABLE "platform_admins" ADD COLUMN "google_sub" TEXT;
CREATE UNIQUE INDEX "platform_admins_google_sub_key" ON "platform_admins" ("google_sub");
