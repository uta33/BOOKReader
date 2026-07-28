CREATE TABLE web_deletion_flows (
  state_hash TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  pkce_verifier TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'consumed')),
  user_id TEXT,
  confirmation_hash TEXT UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX web_deletion_expiry_idx ON web_deletion_flows(expires_at);
