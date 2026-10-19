-- Sign in with Google: the Google account (its stable "sub" id) a user has linked.
ALTER TABLE "users" ADD COLUMN "google_sub" TEXT;
CREATE UNIQUE INDEX "users_google_sub_key" ON "users" ("google_sub");
