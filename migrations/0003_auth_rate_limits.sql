PRAGMA foreign_keys = ON;

CREATE TABLE auth_rate_limits (
  bucket TEXT PRIMARY KEY,
  hits INTEGER NOT NULL DEFAULT 0,
  window_started_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_auth_rate_limits_expires
  ON auth_rate_limits(expires_at);
