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
CREATE INDEX IF NOT EXISTS idx_ws_connections_online 
    ON ws_connections(online);

CREATE INDEX IF NOT EXISTS idx_ws_connections_user_id 
    ON ws_connections(user_id);

CREATE INDEX IF NOT EXISTS idx_active_sessions_entry_id 
    ON active_sessions(entry_id);

CREATE INDEX IF NOT EXISTS idx_active_sessions_user_id 
    ON active_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_active_sessions_last_seen 
    ON active_sessions(last_seen);

CREATE INDEX IF NOT EXISTS idx_friends_user_id 
    ON friends(user_id);

CREATE INDEX IF NOT EXISTS idx_friends_friend_id 
    ON friends(friend_id);

-- ============================================
-- Notifications System Schema
-- Complete notification system for all CRUD operations
-- ============================================

-- ============================================
-- Create notifications table
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    recipient_id VARCHAR(255) NOT NULL,
    sender_id VARCHAR(255),
    type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    read_at TIMESTAMP,
    archived_at TIMESTAMP
);

-- ============================================
-- Create notification preferences table
-- ============================================
CREATE TABLE IF NOT EXISTS notification_preferences (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL,
    email_enabled BOOLEAN DEFAULT TRUE,
    push_enabled BOOLEAN DEFAULT TRUE,
    in_app_enabled BOOLEAN DEFAULT TRUE,
    diary_entry_created BOOLEAN DEFAULT TRUE,
    diary_entry_updated BOOLEAN DEFAULT TRUE,
    diary_entry_deleted BOOLEAN DEFAULT TRUE,
    diary_entry_shared BOOLEAN DEFAULT TRUE,
    comment_created BOOLEAN DEFAULT TRUE,
    comment_updated BOOLEAN DEFAULT TRUE,
    comment_deleted BOOLEAN DEFAULT TRUE,
    friend_request_received BOOLEAN DEFAULT TRUE,
    friend_request_accepted BOOLEAN DEFAULT TRUE,
    collaboration_invite BOOLEAN DEFAULT TRUE,
    collaboration_join BOOLEAN DEFAULT TRUE,
    collaboration_leave BOOLEAN DEFAULT TRUE,
    collaboration_edit BOOLEAN DEFAULT TRUE,
    mention_received BOOLEAN DEFAULT TRUE,
    reaction_received BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Create notification_delivery_status table
-- (Track delivery across channels)
-- ============================================
CREATE TABLE IF NOT EXISTS notification_delivery_status (
    id SERIAL PRIMARY KEY,
    notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL, -- 'websocket', 'email', 'push'
    status VARCHAR(20) NOT NULL, -- 'pending', 'sent', 'delivered', 'failed'
    error_message TEXT,
    attempted_at TIMESTAMP DEFAULT NOW(),
    delivered_at TIMESTAMP
);

-- ============================================
-- Create notification_batches table
-- (For grouping related notifications)
-- ============================================
CREATE TABLE IF NOT EXISTS notification_batches (
    id SERIAL PRIMARY KEY,
    batch_key VARCHAR(255) UNIQUE NOT NULL,
    recipient_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    count INTEGER DEFAULT 1,
    last_notification_id INTEGER REFERENCES notifications(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Create Indexes for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id 
    ON notifications(recipient_id);

CREATE INDEX IF NOT EXISTS idx_notifications_sender_id 
    ON notifications(sender_id);

CREATE INDEX IF NOT EXISTS idx_notifications_type 
    ON notifications(type);

CREATE INDEX IF NOT EXISTS idx_notifications_entity 
    ON notifications(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at 
    ON notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_is_read 
    ON notifications(is_read) WHERE is_read = FALSE;

CREATE INDEX IF NOT EXISTS idx_notifications_is_archived 
    ON notifications(is_archived) WHERE is_archived = FALSE;

CREATE INDEX IF NOT EXISTS idx_notification_prefs_user_id 
    ON notification_preferences(user_id);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_notif_id 
    ON notification_delivery_status(notification_id);

CREATE INDEX IF NOT EXISTS idx_notification_batches_recipient 
    ON notification_batches(recipient_id);

CREATE INDEX IF NOT EXISTS idx_notification_batches_key 
    ON notification_batches(batch_key);

-- ============================================
-- Create trigger to update notification_batches
-- ============================================
CREATE OR REPLACE FUNCTION update_notification_batch()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notification_batches (
        batch_key, 
        recipient_id, 
        type, 
        count, 
        last_notification_id,
        updated_at
    )
    VALUES (
        CONCAT(NEW.recipient_id, '_', NEW.type, '_', DATE(NEW.created_at)),
        NEW.recipient_id,
        NEW.type,
        1,
        NEW.id,
        NOW()
    )
    ON CONFLICT (batch_key) 
    DO UPDATE SET 
        count = notification_batches.count + 1,
        last_notification_id = NEW.id,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_notification_batch
AFTER INSERT ON notifications
FOR EACH ROW
EXECUTE FUNCTION update_notification_batch();

-- ============================================
-- Create function to get unread count
-- ============================================
CREATE OR REPLACE FUNCTION get_unread_count(p_user_id VARCHAR)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*) 
        FROM notifications 
        WHERE recipient_id = p_user_id 
        AND is_read = FALSE 
        AND is_archived = FALSE
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Create function to mark notifications as read
-- ============================================
CREATE OR REPLACE FUNCTION mark_notifications_read(
    p_user_id VARCHAR,
    p_notification_ids INTEGER[] DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    IF p_notification_ids IS NULL THEN
        -- Mark all as read
        UPDATE notifications 
        SET is_read = TRUE, read_at = NOW()
        WHERE recipient_id = p_user_id 
        AND is_read = FALSE;
    ELSE
        -- Mark specific notifications as read
        UPDATE notifications 
        SET is_read = TRUE, read_at = NOW()
        WHERE recipient_id = p_user_id 
        AND id = ANY(p_notification_ids)
        AND is_read = FALSE;
    END IF;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Create function to archive old notifications
-- ============================================
CREATE OR REPLACE FUNCTION archive_old_notifications(days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    UPDATE notifications 
    SET is_archived = TRUE, archived_at = NOW()
    WHERE created_at < NOW() - (days_old || ' days')::INTERVAL
    AND is_archived = FALSE;
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Insert default notification preferences for existing users
-- ============================================
INSERT INTO notification_preferences (user_id)
SELECT DISTINCT user_id FROM diary_entries
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- Sample Notification Data
-- ============================================
INSERT INTO notifications (recipient_id, sender_id, type, entity_type, entity_id, title, message, metadata) VALUES
('user_1', 'user_2', 'diary_entry_created', 'diary_entry', 'entry_123', 'New Diary Entry', 'user_2 created a new diary entry', '{"entry_title": "My First Entry"}'),
('user_2', 'user_1', 'comment_created', 'comment', 'comment_456', 'New Comment', 'user_1 commented on your entry', '{"comment_preview": "Great entry!"}'),
('user_1', 'user_3', 'friend_request_received', 'friend_request', 'req_789', 'Friend Request', 'user_3 sent you a friend request', '{}')
ON CONFLICT DO NOTHING;

-- ============================================
-- Verify Tables Created
-- ============================================
SELECT 'Notification tables created successfully!' as status;

-- Show notification-related tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'notification%'
ORDER BY table_name;