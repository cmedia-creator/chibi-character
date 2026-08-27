PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);

CREATE TABLE passkey_credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  credential_id TEXT NOT NULL UNIQUE,
  public_key BLOB NOT NULL,
  sign_count INTEGER NOT NULL DEFAULT 0,
  transports_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_passkey_credentials_user
  ON passkey_credentials(user_id);

CREATE TABLE webauthn_challenges (
  challenge_hash TEXT PRIMARY KEY,
  user_id TEXT,
  purpose TEXT NOT NULL CHECK (purpose IN ('register', 'authenticate')),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_webauthn_challenges_expires
  ON webauthn_challenges(expires_at);

CREATE TABLE sessions (
  id_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user
  ON sessions(user_id);

CREATE INDEX idx_sessions_expires
  ON sessions(expires_at);

CREATE TABLE characters (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'MY CHARACTER',
  appearance_json TEXT NOT NULL,
  room_json TEXT NOT NULL DEFAULT '{}',
  schema_version INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_characters_user_updated
  ON characters(user_id, updated_at DESC);

CREATE TABLE profiles (
  user_id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  oshi_name TEXT NOT NULL DEFAULT '',
  oshi_since TEXT NOT NULL DEFAULT '',
  favorite_song TEXT NOT NULL DEFAULT '',
  favorite_point TEXT NOT NULL DEFAULT '',
  doufan_stance TEXT NOT NULL DEFAULT '',
  participation_history TEXT NOT NULL DEFAULT '',
  favorite_outfit TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  theme_id TEXT NOT NULL DEFAULT 'simple',
  visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'unlisted', 'public')),
  schema_version INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_profiles_visibility_updated
  ON profiles(visibility, updated_at DESC);

CREATE TABLE entitlements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  pack_id TEXT NOT NULL,
  transaction_id TEXT,
  acquired_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, pack_id)
);

CREATE INDEX idx_entitlements_user
  ON entitlements(user_id);

CREATE TABLE share_assets (
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('profile-card', 'chibi-card', 'og-image')),
  storage_key TEXT NOT NULL,
  content_hash TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, type),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE payment_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  received_at INTEGER NOT NULL
);
