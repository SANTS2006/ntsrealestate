-- Adds "building" as a valid DocumentEntityType so images/videos can be
-- attached to a Building directly (previously only Property and Unit).
ALTER TYPE "DocumentEntityType" ADD VALUE IF NOT EXISTS 'building';
