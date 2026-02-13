# Waddles Database Schema Documentation

## Overview

The Waddles application uses **PostgreSQL 16** as the primary database. The schema is organized in three migration files that are automatically applied on container startup.

---

## Migration Files

### **001_lola_schema.sql** - Real-time & Diary Tracking
Basic real-time tracking tables for active sessions and websocket connections.

| Table | Purpose | Columns |
|-------|---------|---------|
| `active_sessions` | Track active diary viewers | `entry_id`, `user_id`, `status`, `last_seen` |
| `ws_connections` | WebSocket connection tracking | `user_id`, `socket_id`, `last_seen` |
| `friends` | Friends list | `user_id`, `friend_id` |
| `diary_entries` | Diary content storage | `id`, `content`, `updated_at` |

---

### **002_lola_schema.sql** - Complete User & Social Features
Main application schema with users, friendships, collaboration, and notifications.

#### **USERS Table**
Core user account information.

```sql
CREATE TABLE users (
  id VARCHAR(255) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),        -- NULL for OAuth-only users
  full_name VARCHAR(100),
  avatar VARCHAR(500),
  bio TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);
```

**Indexes:**
- `idx_users_username` - Fast username lookups
- `idx_users_email` - Fast email lookups
- `idx_users_created_at` - Chronological queries

---

#### **FRIEND_REQUESTS Table**
Manage pending and accepted friend requests.

```sql
CREATE TABLE friend_requests (
  id VARCHAR(255) PRIMARY KEY,
  sender_id VARCHAR(255) NOT NULL,
  receiver_id VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',  -- pending, accepted, rejected
  message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_friend_request UNIQUE(sender_id, receiver_id),
  CONSTRAINT no_self_request CHECK (sender_id != receiver_id)
);
```

**Status Values:**
- `pending` - Awaiting response
- `accepted` - Friends added
- `rejected` - Request declined

**Constraints:**
- Can't send duplicate requests
- Can't add yourself

**Indexes:**
- `idx_friend_requests_receiver` - Find pending requests for user
- `idx_friend_requests_sender` - Find sent requests
- `idx_friend_requests_status` - Filter by status

---

#### **COLLABORATORS Table**
Manage diary entry collaborators and invitations.

```sql
CREATE TABLE collaborators (
  id VARCHAR(255) PRIMARY KEY,
  entry_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'viewer',     -- viewer, editor, admin
  invited_by VARCHAR(255) NOT NULL,
  invited_at TIMESTAMP DEFAULT NOW(),
  accepted_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'pending',  -- pending, accepted, rejected
  CONSTRAINT unique_collaboration UNIQUE(entry_id, user_id)
);
```

**Role Values:**
- `viewer` - Read-only access
- `editor` - Can edit content
- `admin` - Full control + can invite others

**Status Values:**
- `pending` - Awaiting acceptance
- `accepted` - Invitation accepted
- `rejected` - Invitation declined

**Indexes:**
- `idx_collaborators_entry` - Find all collaborators for entry
- `idx_collaborators_user` - Find user's collaborations
- `idx_collaborators_status` - Filter by status
- `idx_collaborators_invited_by` - Track invitations sent

---

#### **DIARY_ENTRIES Table**
Enhanced with ownership and privacy settings.

```sql
ALTER TABLE diary_entries ADD COLUMN owner_id VARCHAR(255);
ALTER TABLE diary_entries ADD COLUMN title VARCHAR(255);
ALTER TABLE diary_entries ADD COLUMN cover_image VARCHAR(500);
ALTER TABLE diary_entries ADD COLUMN is_private BOOLEAN DEFAULT TRUE;
ALTER TABLE diary_entries ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
```

**Privacy:**
- `is_private = TRUE` - Only owner and collaborators can access
- `is_private = FALSE` - Public diary (future feature)

**Indexes:**
- `idx_diary_entries_owner` - Find user's diaries
- `idx_diary_entries_created_at` - Sort by date
- `idx_diary_entries_is_private` - Filter by privacy

---

#### **WS_CONNECTIONS Table**
Real-time WebSocket connection tracking.

```sql
ALTER TABLE ws_connections ADD COLUMN is_online BOOLEAN DEFAULT TRUE;
ALTER TABLE ws_connections ADD COLUMN connected_at TIMESTAMP DEFAULT NOW();
```

**Purpose:** Track active WebSocket connections for real-time features.

**Indexes:**
- `idx_ws_connections_is_online` - Find active users
- `idx_ws_connections_last_seen` - Detect inactive connections

---

#### **FRIENDS Table**
Confirmed friendships (bidirectional).

```sql
ALTER TABLE friends ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
```

**Note:** Entries are bidirectional:
- If A is friends with B, both (A,B) and (B,A) exist

**Indexes:**
- `idx_friends_created_at` - Sort friend list by date

---

#### **ACTIVITY_LOG Table**
Audit trail of user actions.

```sql
CREATE TABLE activity_log (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL,         -- created, updated, shared, etc
  entity_type VARCHAR(50),              -- diary, collaborator, friend, etc
  entity_id VARCHAR(255),
  metadata JSONB DEFAULT '{}',          -- Additional data as JSON
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Example Actions:**
- `user_123` created a `diary` entry `entry_456`
- `user_789` invited `user_123` as a `collaborator` on `entry_456`
- `user_123` accepted a `friend_request` from `user_456`

**Indexes:**
- `idx_activity_log_user` - Find user's activity history
- `idx_activity_log_entity` - Find all actions for an entity
- `idx_activity_log_created_at` - Sort by date

---

#### **NOTIFICATIONS Table**
In-app notifications for users.

```sql
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  recipient_id TEXT NOT NULL,
  sender_id TEXT,
  type TEXT NOT NULL,                  -- friend_request, collaboration_invite, etc
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMP,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Notification Types:**
- `friend_request` - Someone sent friend request
- `collaboration_invite` - Invited to diary
- `collaboration_accepted` - Invitation accepted
- `diary_shared` - Diary was shared with you

**Indexes:**
- `idx_notifications_recipient_created` - Get user's notifications
- `idx_notifications_unread` - Find unread/active notifications

---

### **003_oauth_schema.sql** - OAuth & Social Login
Added in this session for Google OAuth integration.

#### **Changes to USERS Table**

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_last_login TIMESTAMP;

-- Make password nullable for OAuth-only users
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
```

**New OAuth Columns:**

| Column | Type | Purpose |
|--------|------|---------|
| `google_id` | VARCHAR(255) UNIQUE | Google's unique user identifier |
| `oauth_provider` | VARCHAR(50) | Login provider (google, github, etc) |
| `oauth_last_login` | TIMESTAMP | Track last OAuth login |
| `password_hash` | VARCHAR(255) NULL | NULL if OAuth-only user |

**Indexes:**
- `idx_users_google_id` - Fast lookup by Google ID
- `idx_users_oauth_provider` - Filter by provider

---

#### **OAUTH_TOKENS Table**
Store OAuth provider tokens for later use.

```sql
CREATE TABLE oauth_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  provider VARCHAR(50) NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Purpose:**
- Store Google access/refresh tokens
- Allow integration with Google services
- Auto-refresh tokens when expired

**Indexes:**
- `idx_oauth_tokens_user_id` - Get tokens for user
- `idx_oauth_tokens_provider` - Filter by provider

---

## Complete Database Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        USERS                                 │
├─────────────────────────────────────────────────────────────┤
│ id (PK)              │ username (UNIQUE)                    │
│ email (UNIQUE)       │ password_hash (nullable)             │
│ full_name            │ avatar                               │
│ bio                  │ is_active                            │
│ google_id (UNIQUE)   │ oauth_provider                       │
│ oauth_last_login     │ created_at, updated_at               │
└─────────────────────────────────────────────────────────────┘
         │ owns                      │ sent              │ connected
         │                           │                   │
         ▼                           ▼                   ▼
    DIARY_ENTRIES          FRIEND_REQUESTS        WS_CONNECTIONS
    ├─ owner_id ────────── sender_id              ├─ socket_id
    ├─ title              ├─ receiver_id          ├─ is_online
    ├─ is_private         ├─ status               └─ last_seen
    └─ cover_image        └─ message
         │ has
         ▼
    COLLABORATORS
    ├─ user_id (FK → users)
    ├─ role
    ├─ status
    └─ invited_by (FK → users)
         
Additional Tables:
├─ FRIENDS (bidirectional friendships)
├─ ACTIVITY_LOG (audit trail)
├─ NOTIFICATIONS (in-app messages)
└─ OAUTH_TOKENS (provider tokens)
```

---

## Data Types

| Type | Usage | Example |
|------|-------|---------|
| `TEXT` | IDs, primary keys | `user_123`, `entry_456` |
| `VARCHAR(n)` | Fixed-length strings | usernames (50), emails (255) |
| `TIMESTAMP` | Dates with time | `2026-02-13 14:30:00` |
| `BOOLEAN` | True/False values | `is_private`, `is_online` |
| `JSONB` | JSON data | `{"role": "editor", "accepted": true}` |
| `INTEGER` | Numbers | Activity log IDs |

---

## Key Constraints & Relationships

### Referential Integrity
- `oauth_tokens.user_id` → `users.id` (ON DELETE CASCADE)
- `collaborators.user_id` → `users.id` (implied)
- `diary_entries.owner_id` → `users.id` (implied)

### Uniqueness Constraints
- `users.username` - Can't have duplicate usernames
- `users.email` - Can't have duplicate emails
- `users.google_id` - Each Google account linked to max 1 user
- `friend_requests (sender_id, receiver_id)` - Can't send duplicate requests
- `collaborators (entry_id, user_id)` - Can't invite same person twice
- `oauth_tokens (user_id)` - Max 1 token per provider per user

### Check Constraints
- `friend_requests: sender_id != receiver_id` - Can't befriend yourself

---

## Sample Queries

### Find user by email
```sql
SELECT * FROM users WHERE email = 'john@example.com';
```

### Get all pending friend requests for a user
```sql
SELECT * FROM friend_requests 
WHERE receiver_id = $1 AND status = 'pending'
ORDER BY created_at DESC;
```

### Get diary collaborators with roles
```sql
SELECT u.username, c.role, c.status, c.invited_at
FROM collaborators c
JOIN users u ON c.user_id = u.id
WHERE c.entry_id = $1 AND c.status = 'accepted';
```

### Get user's active sessions
```sql
SELECT * FROM active_sessions 
WHERE user_id = $1 AND status = 'viewing';
```

### Find user by Google ID (OAuth login)
```sql
SELECT * FROM users WHERE google_id = $1;
```

### Get user's notification count
```sql
SELECT COUNT(*) as unread_count FROM notifications
WHERE recipient_id = $1 AND is_read = FALSE AND is_archived = FALSE;
```

---

## Performance Considerations

### Indexes
- All foreign key lookups are indexed
- Creator/owner fields indexed for filtering
- Status fields indexed for common queries
- Timestamps indexed for sorting

### Query Optimization
- Use indexes for WHERE clauses on: email, username, user_id, status
- LIMIT results for pagination (notif lists, friend requests)
- Use JSONB for metadata to avoid creating new columns

### Scaling
- `activity_log` and `notifications` tables will grow large
- Consider archiving old records periodically
- Implement pagination for all list queries

---

## Migration Strategy

### Order of Application
1. **001_lola_schema.sql** - Basic tables (order matters!)
2. **002_lola_schema.sql** - User & social features (depends on 001)
3. **003_oauth_schema.sql** - OAuth enhancements (backward compatible)

### Adding New Migrations
1. Create `00X_description.sql` in `/infrastructure/db/init/`
2. Use `IF NOT EXISTS` for all CREATE statements
3. Test on local database first
4. Rebuild containers: `docker compose up -d --build`

---

## Backup & Maintenance

### Backup Database
```bash
docker exec infrastructure-postgres-1 pg_dump -U postgres auth_db > backup.sql
```

### Restore Database
```bash
docker exec -i infrastructure-postgres-1 psql -U postgres auth_db < backup.sql
```

### Check Table Sizes
```sql
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

**Document Version:** 1.0  
**Last Updated:** February 13, 2026  
**Database:** PostgreSQL 16  
**Application:** Waddles Diary Platform
