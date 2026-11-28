-- Adds the profile picture and link columns to an existing database.
-- Apply BEFORE deploying the worker: npx wrangler d1 execute 30p30d-participants --remote --file=migrations/001-profile-picture-and-links.sql
ALTER TABLE participants ADD COLUMN avatar_key TEXT;
ALTER TABLE participants ADD COLUMN website TEXT;
ALTER TABLE participants ADD COLUMN x_url TEXT;
ALTER TABLE participants ADD COLUMN instagram_url TEXT;
ALTER TABLE participants ADD COLUMN linkedin_url TEXT;
