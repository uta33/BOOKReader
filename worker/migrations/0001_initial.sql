PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  seq INTEGER NOT NULL DEFAULT 0,
  min_available_rev INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX sessions_user_idx ON sessions(user_id);

CREATE TABLE anonymous_issuance (
  ip_hash TEXT NOT NULL,
  hour_bucket TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0 CHECK (count <= 5),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (ip_hash, hour_bucket)
);

CREATE TABLE quota_daily (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  summary_count INTEGER NOT NULL DEFAULT 0 CHECK (summary_count <= 20),
  quiz_count INTEGER NOT NULL DEFAULT 0 CHECK (quiz_count <= 40),
  tts_chars INTEGER NOT NULL DEFAULT 0 CHECK (tts_chars <= 100000),
  ocr_pages INTEGER NOT NULL DEFAULT 0 CHECK (ocr_pages <= 200),
  spend_microusd INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, day)
);

CREATE TABLE budget_periods (
  period_type TEXT NOT NULL CHECK (period_type IN ('day', 'month')),
  bucket TEXT NOT NULL,
  spend_microusd INTEGER NOT NULL DEFAULT 0,
  cap_microusd INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (spend_microusd <= cap_microusd),
  PRIMARY KEY (period_type, bucket)
);

CREATE TABLE books (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  isbn TEXT,
  payload_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  origin_device_id TEXT NOT NULL,
  rev INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX books_user_rev_idx ON books(user_id, rev);
CREATE INDEX books_user_isbn_idx ON books(user_id, isbn);

CREATE TABLE dog_ears (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  book_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  origin_device_id TEXT NOT NULL,
  rev INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX dog_ears_user_rev_idx ON dog_ears(user_id, rev);
CREATE INDEX dog_ears_book_idx ON dog_ears(user_id, book_id);

CREATE TABLE digital_links (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  book_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  origin_device_id TEXT NOT NULL,
  rev INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX digital_links_user_rev_idx ON digital_links(user_id, rev);
CREATE INDEX digital_links_book_idx ON digital_links(user_id, book_id);

CREATE TABLE sync_changes (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rev INTEGER NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('book', 'dogEar', 'digitalLink')),
  entity_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, rev)
);
CREATE INDEX sync_changes_pull_idx ON sync_changes(user_id, rev);

CREATE TABLE google_identities (
  google_sub TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  email TEXT,
  linked_at INTEGER NOT NULL
);

CREATE TABLE oauth_flows (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ticket_hash TEXT NOT NULL UNIQUE,
  state_hash TEXT NOT NULL UNIQUE,
  nonce TEXT NOT NULL,
  pkce_verifier TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'complete', 'choice_required', 'consumed', 'cancelled')),
  google_sub TEXT,
  google_email TEXT,
  conflict_user_id TEXT,
  expires_at INTEGER NOT NULL,
  completed_at INTEGER,
  consumed_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX oauth_flows_expiry_idx ON oauth_flows(expires_at);

CREATE TABLE account_merges (
  id TEXT PRIMARY KEY,
  source_user_id TEXT NOT NULL,
  target_user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'complete', 'failed', 'cancelled')),
  error TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE TABLE deletion_tickets (
  ticket_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  created_at INTEGER NOT NULL
);
