-- active sessions per entry
CREATE TABLE IF NOT EXISTS active_sessions (
  entry_id     TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'viewing',
  last_seen    TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (entry_id, user_id)
);

-- websocket connection tracking (your PONG handler updates this)
CREATE TABLE IF NOT EXISTS ws_connections (
  user_id      TEXT PRIMARY KEY,
  socket_id    TEXT,
  last_seen    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- friends list (used by friends handler)
CREATE TABLE IF NOT EXISTS friends (
  user_id      TEXT NOT NULL,
  friend_id    TEXT NOT NULL,
  PRIMARY KEY (user_id, friend_id)
);

-- diary entries for STATE_REQUEST
CREATE TABLE IF NOT EXISTS diary_entries (
  id          TEXT PRIMARY KEY,
  content     TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
