-- ============================================
-- Main application tables
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
  avatar_url TEXT,
  bio TEXT,
  google_id VARCHAR(255) UNIQUE,
  oauth_provider VARCHAR(50),
  oauth_last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_oauth_provider ON users(oauth_provider);
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
-- FRIENDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS friends (
  user_id TEXT NOT NULL,
  friend_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friends_created_at ON friends(created_at);

-- ============================================
-- DIARY ENTRIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS diary_entries (
  id TEXT PRIMARY KEY,
  owner_id VARCHAR(255),
  title VARCHAR(255),
  content TEXT NOT NULL DEFAULT '',
  cover_image VARCHAR(500),
  is_private BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diary_entries_owner ON diary_entries(owner_id);
CREATE INDEX IF NOT EXISTS idx_diary_entries_created_at ON diary_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diary_entries_is_private ON diary_entries(is_private);

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
  id TEXT PRIMARY KEY,
  recipient_id TEXT NOT NULL,
  sender_id TEXT,
  type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
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

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created ON notifications (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications (recipient_id, is_read, is_archived);

-- ============================================
-- WEBSOCKET CONNECTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS ws_connections (
  user_id TEXT PRIMARY KEY,
  socket_id TEXT,
  is_online BOOLEAN DEFAULT TRUE,
  connected_at TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ws_connections_is_online ON ws_connections(is_online);
CREATE INDEX IF NOT EXISTS idx_ws_connections_last_seen ON ws_connections(last_seen);

-- ============================================
-- ACTIVE SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS active_sessions (
  entry_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'viewing',
  last_seen TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (entry_id, user_id)
);

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
