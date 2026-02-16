-- ============================================
-- Relational integrity (foreign keys + indexes)
-- ============================================

-- Friend requests -> users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'friend_requests'
      AND constraint_name = 'fk_friend_requests_sender'
  ) THEN
    ALTER TABLE friend_requests
      ADD CONSTRAINT fk_friend_requests_sender
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'friend_requests'
      AND constraint_name = 'fk_friend_requests_receiver'
  ) THEN
    ALTER TABLE friend_requests
      ADD CONSTRAINT fk_friend_requests_receiver
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Friends -> users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'friends'
      AND constraint_name = 'fk_friends_user'
  ) THEN
    ALTER TABLE friends
      ADD CONSTRAINT fk_friends_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'friends'
      AND constraint_name = 'fk_friends_friend'
  ) THEN
    ALTER TABLE friends
      ADD CONSTRAINT fk_friends_friend
      FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Diary entries -> users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'diary_entries'
      AND constraint_name = 'fk_diary_entries_owner'
  ) THEN
    ALTER TABLE diary_entries
      ADD CONSTRAINT fk_diary_entries_owner
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Collaborators -> diary_entries/users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'collaborators'
      AND constraint_name = 'fk_collaborators_entry'
  ) THEN
    ALTER TABLE collaborators
      ADD CONSTRAINT fk_collaborators_entry
      FOREIGN KEY (entry_id) REFERENCES diary_entries(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'collaborators'
      AND constraint_name = 'fk_collaborators_user'
  ) THEN
    ALTER TABLE collaborators
      ADD CONSTRAINT fk_collaborators_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'collaborators'
      AND constraint_name = 'fk_collaborators_invited_by'
  ) THEN
    ALTER TABLE collaborators
      ADD CONSTRAINT fk_collaborators_invited_by
      FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Notifications -> users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'notifications'
      AND constraint_name = 'fk_notifications_recipient'
  ) THEN
    ALTER TABLE notifications
      ADD CONSTRAINT fk_notifications_recipient
      FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'notifications'
      AND constraint_name = 'fk_notifications_sender'
  ) THEN
    ALTER TABLE notifications
      ADD CONSTRAINT fk_notifications_sender
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Websocket status -> users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'ws_connections'
      AND constraint_name = 'fk_ws_connections_user'
  ) THEN
    ALTER TABLE ws_connections
      ADD CONSTRAINT fk_ws_connections_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Active sessions -> diary_entries/users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'active_sessions'
      AND constraint_name = 'fk_active_sessions_entry'
  ) THEN
    ALTER TABLE active_sessions
      ADD CONSTRAINT fk_active_sessions_entry
      FOREIGN KEY (entry_id) REFERENCES diary_entries(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'active_sessions'
      AND constraint_name = 'fk_active_sessions_user'
  ) THEN
    ALTER TABLE active_sessions
      ADD CONSTRAINT fk_active_sessions_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Helpful indexes for FK columns
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender_id ON friend_requests(sender_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver_id ON friend_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_diary_entries_owner_id ON diary_entries(owner_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_entry_id ON collaborators(entry_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_user_id ON collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_invited_by_id ON collaborators(invited_by);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sender_id ON notifications(sender_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_entry_id ON active_sessions(entry_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_user_id ON active_sessions(user_id);
