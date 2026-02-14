-- ============================================
-- WADDLES Complete Database Schema
-- Run this after 001_lola_schema.sql
-- ============================================

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  full_name VARCHAR(100),
  avatar VARCHAR(500),
  bio TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- ============================================
-- FRIEND REQUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS friend_requests (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  sender_id VARCHAR(255) NOT NULL,
  receiver_id VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_friend_request UNIQUE(sender_id, receiver_id),
  CONSTRAINT no_self_request CHECK (sender_id != receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON friend_requests(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON friend_requests(sender_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON friend_requests(status);

-- ============================================
-- COLLABORATORS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS collaborators (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  entry_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'viewer',
  invited_by VARCHAR(255) NOT NULL,
  invited_at TIMESTAMP DEFAULT NOW(),
  accepted_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'pending',
  CONSTRAINT unique_collaboration UNIQUE(entry_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_collaborators_entry ON collaborators(entry_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_user ON collaborators(user_id, status);
CREATE INDEX IF NOT EXISTS idx_collaborators_status ON collaborators(status);
CREATE INDEX IF NOT EXISTS idx_collaborators_invited_by ON collaborators(invited_by);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(255) PRIMARY KEY,
  recipient_id VARCHAR(255) NOT NULL,
  sender_id VARCHAR(255),
  type VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(255),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  is_archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON notifications(recipient_id, is_read, is_archived);

-- ============================================
-- UPDATE diary_entries TO ADD MISSING COLUMNS
-- ============================================
ALTER TABLE diary_entries 
  ADD COLUMN IF NOT EXISTS owner_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS title VARCHAR(255),
  ADD COLUMN IF NOT EXISTS cover_image VARCHAR(500),
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_diary_entries_owner ON diary_entries(owner_id);
CREATE INDEX IF NOT EXISTS idx_diary_entries_created_at ON diary_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diary_entries_is_private ON diary_entries(is_private);

-- ============================================
-- UPDATE ws_connections TO ADD MISSING COLUMNS
-- ============================================
ALTER TABLE ws_connections
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS connected_at TIMESTAMP DEFAULT NOW();

-- Fix primary key if needed
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'ws_connections' AND constraint_type = 'PRIMARY KEY'
  ) THEN
    ALTER TABLE ws_connections ADD PRIMARY KEY (user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ws_connections_is_online ON ws_connections(is_online);
CREATE INDEX IF NOT EXISTS idx_ws_connections_last_seen ON ws_connections(last_seen);

-- ============================================
-- UPDATE friends TABLE TO ADD TIMESTAMP
-- ============================================
ALTER TABLE friends
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_friends_created_at ON friends(created_at);

-- ============================================
-- ACTIVITY LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);

-- ============================================
-- Insert test users (for development)
-- ============================================
INSERT INTO users (id, username, email, full_name, avatar, bio) VALUES
('user_1', 'alice', 'alice@test.com', 'Alice Johnson', 'https://i.pravatar.cc/150?u=alice', 'Love writing diaries!'),
('user_2', 'bob', 'bob@test.com', 'Bob Smith', 'https://i.pravatar.cc/150?u=bob', 'Diary enthusiast'),
('user_3', 'charlie', 'charlie@test.com', 'Charlie Brown', 'https://i.pravatar.cc/150?u=charlie', 'Writer and thinker')
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  avatar = EXCLUDED.avatar,
  bio = EXCLUDED.bio;

-- ============================================
-- Create sample friendships (for testing)
-- ============================================
INSERT INTO friends (user_id, friend_id) VALUES
('user_1', 'user_2'),
('user_2', 'user_1'),
('user_1', 'user_3'),
('user_3', 'user_1')
ON CONFLICT (user_id, friend_id) DO NOTHING;

-- ============================================
-- Create sample diary entries (for testing)
-- ============================================
INSERT INTO diary_entries (id, owner_id, title, content) VALUES
('entry_1', 'user_1', 'My First Diary', '{"pages": [{"content": "This is my first entry"}]}'),
('entry_2', 'user_2', 'Travel Diary', '{"pages": [{"content": "My adventures"}]}'),
('entry_3', 'user_3', 'Daily Journal', '{"pages": [{"content": "Today was great"}]}')
ON CONFLICT (id) DO UPDATE SET
  owner_id = EXCLUDED.owner_id,
  title = EXCLUDED.title,
  content = EXCLUDED.content;

-- ============================================
-- Verification queries
-- ============================================

-- Count all tables
SELECT 
  'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'friends', COUNT(*) FROM friends
UNION ALL
SELECT 'friend_requests', COUNT(*) FROM friend_requests
UNION ALL
SELECT 'diary_entries', COUNT(*) FROM diary_entries
UNION ALL
SELECT 'collaborators', COUNT(*) FROM collaborators
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL
SELECT 'ws_connections', COUNT(*) FROM ws_connections
UNION ALL
SELECT 'active_sessions', COUNT(*) FROM active_sessions
ORDER BY table_name;

-- Show all table names
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

SELECT '✅ Complete schema applied successfully!' as status;
