-- D1 schema for the participants API. Apply with: npx wrangler d1 execute 30p30d-participants --remote --file=schema.sql
CREATE TABLE IF NOT EXISTS participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  username TEXT UNIQUE,
  display_name TEXT,
  bio TEXT,
  avatar_key TEXT,                           -- R2 key of the profile picture
  website TEXT,                              -- https link
  x_url TEXT,
  instagram_url TEXT,
  linkedin_url TEXT,
  status TEXT NOT NULL DEFAULT 'approved',   -- approved | suspended
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS login_tokens (
  hash TEXT PRIMARY KEY,
  participant_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
  hash TEXT PRIMARY KEY,
  participant_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id INTEGER NOT NULL,
  day INTEGER NOT NULL CHECK (day BETWEEN 1 AND 30),
  product_name TEXT NOT NULL DEFAULT '',
  pitch TEXT NOT NULL DEFAULT '',
  product_url TEXT NOT NULL DEFAULT '',
  price TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'Digital',      -- Digital | Physical | Service
  body TEXT NOT NULL DEFAULT '',
  image_key TEXT,
  status TEXT NOT NULL DEFAULT 'draft',      -- draft | published
  hidden INTEGER NOT NULL DEFAULT 0,         -- set by an admin only
  updated_at INTEGER NOT NULL,
  UNIQUE (participant_id, day)
);
CREATE TABLE IF NOT EXISTS rate (k TEXT NOT NULL, ts INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS rate_k ON rate (k, ts);
CREATE INDEX IF NOT EXISTS entries_day ON entries (day, status, hidden);
