-- Extra D1 tables for the MCP server (OAuth 2.1 with PKCE). Participants, entries, rate and sessions already exist.
-- Apply with: npx wrangler d1 execute 30p30d-participants --remote --file=schema.sql
CREATE TABLE IF NOT EXISTS oauth_clients (
  client_id TEXT PRIMARY KEY,
  client_name TEXT NOT NULL DEFAULT '',
  redirect_uris TEXT NOT NULL,                 -- JSON array
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS oauth_requests (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT '',
  code_challenge TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS oauth_email_tokens (
  hash TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  participant_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS oauth_codes (
  hash TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  participant_id INTEGER NOT NULL,
  code_challenge TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS oauth_tokens (
  hash TEXT PRIMARY KEY,
  kind TEXT NOT NULL,                          -- access | refresh
  participant_id INTEGER NOT NULL,
  client_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS oauth_tokens_p ON oauth_tokens (participant_id);
