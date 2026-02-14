-- ============================================
-- Backend enforcement aligned with app rules
-- ============================================

-- Users: OAuth-support fields
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id_unique
  ON users (google_id)
  WHERE google_id IS NOT NULL;

-- Friend request lifecycle enforcement
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'friend_requests'
      AND constraint_name = 'friend_requests_status_check'
  ) THEN
    ALTER TABLE friend_requests
      ADD CONSTRAINT friend_requests_status_check
      CHECK (status IN ('pending', 'accepted', 'declined'));
  END IF;
END $$;

-- OAuth token storage (deleted automatically when user is deleted)
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL DEFAULT 'google',
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT oauth_tokens_user_provider_unique UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_provider
  ON oauth_tokens (user_id, provider);

-- Collaborator lifecycle and role enforcement
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'collaborators'
      AND constraint_name = 'collaborators_status_check'
  ) THEN
    ALTER TABLE collaborators
      ADD CONSTRAINT collaborators_status_check
      CHECK (status IN ('pending', 'accepted', 'declined', 'removed'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'collaborators'
      AND constraint_name = 'collaborators_role_check'
  ) THEN
    ALTER TABLE collaborators
      ADD CONSTRAINT collaborators_role_check
      CHECK (role IN ('viewer', 'editor'));
  END IF;
END $$;

-- Diary type model (private | collaborative) with strict alignment to is_private
ALTER TABLE diary_entries
  ADD COLUMN IF NOT EXISTS diary_type TEXT;

UPDATE diary_entries
SET diary_type = CASE WHEN is_private THEN 'private' ELSE 'collaborative' END
WHERE diary_type IS NULL;

ALTER TABLE diary_entries
  ALTER COLUMN diary_type SET DEFAULT 'private';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'diary_entries'
      AND constraint_name = 'diary_entries_diary_type_check'
  ) THEN
    ALTER TABLE diary_entries
      ADD CONSTRAINT diary_entries_diary_type_check
      CHECK (diary_type IN ('private', 'collaborative'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'diary_entries'
      AND constraint_name = 'diary_entries_privacy_alignment_check'
  ) THEN
    ALTER TABLE diary_entries
      ADD CONSTRAINT diary_entries_privacy_alignment_check
      CHECK (
        (diary_type = 'private' AND is_private = TRUE)
        OR
        (diary_type = 'collaborative' AND is_private = FALSE)
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION enforce_single_diary_type_per_owner()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM diary_entries d
    WHERE d.owner_id = NEW.owner_id
      AND d.id <> NEW.id
      AND COALESCE(d.diary_type, CASE WHEN d.is_private THEN 'private' ELSE 'collaborative' END)
          = COALESCE(NEW.diary_type, CASE WHEN NEW.is_private THEN 'private' ELSE 'collaborative' END)
  ) THEN
    RAISE EXCEPTION 'Owner already has a % diary',
      COALESCE(NEW.diary_type, CASE WHEN NEW.is_private THEN 'private' ELSE 'collaborative' END)
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_single_diary_type_per_owner ON diary_entries;

CREATE TRIGGER trg_enforce_single_diary_type_per_owner
BEFORE INSERT OR UPDATE OF owner_id, diary_type, is_private
ON diary_entries
FOR EACH ROW
EXECUTE FUNCTION enforce_single_diary_type_per_owner();

CREATE INDEX IF NOT EXISTS idx_diary_entries_owner_type
  ON diary_entries (owner_id, diary_type);

-- Persistent notifications (survive offline users)
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  recipient_id VARCHAR(255) NOT NULL,
  sender_id VARCHAR(255),
  type VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(255),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMP,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON notifications (recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON notifications (recipient_id, is_read, is_archived);

-- Global websocket online status
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'ws_connections'
  ) THEN
    ALTER TABLE ws_connections
      ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS connected_at TIMESTAMP NOT NULL DEFAULT NOW();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ws_connections_online_last_seen
  ON ws_connections (is_online, last_seen DESC);

-- Activity log for history/auditing
CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(60),
  entity_id VARCHAR(255),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user_created
  ON activity_log (user_id, created_at DESC);
