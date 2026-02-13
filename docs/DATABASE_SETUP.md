# Database Setup & Configuration Guide

## Quick Start

### 1. Container Setup
The database is automatically initialized on Docker startup.

```bash
cd /home/fkuruthl/Desktop/unsahi/infrastructure
docker compose up -d
```

**What happens:**
1. PostgreSQL container starts
2. Migrations run in order: 001 → 002 → 003
3. Test data inserted (alice, bob, charlie)
4. Auth service connects and runs

---

## Environment Variables

Located in `docker-compose.yml` and `.env`:

```env
# Database Connection
PGHOST=postgres              # Docker hostname (internal)
PGPORT=5432                  # Standard PostgreSQL port
PGUSER=postgres              # Database user
PGPASSWORD=postgres          # Database password (change in production!)
PGDATABASE=auth_db           # Database name

# For local development (outside Docker)
# PGHOST=localhost            # Use localhost instead
```

---

## Database Tools

### 1. Connect to PostgreSQL

**From inside Docker container:**
```bash
docker compose exec postgres psql -U postgres -d auth_db
```

**From your machine (if PostgreSQL client installed):**
```bash
psql -h localhost -U postgres -d auth_db
```

---

### 2. Common Commands

**List all tables:**
```sql
\dt
```

**Describe table structure:**
```sql
\d users
\d oauth_tokens
```

**Count rows in each table:**
```sql
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'friend_requests', COUNT(*) FROM friend_requests
UNION ALL
SELECT 'collaborators', COUNT(*) FROM collaborators
UNION ALL
SELECT 'diary_entries', COUNT(*) FROM diary_entries;
```

**View all indexes:**
```sql
\di
```

**Exit psql:**
```sql
\q
```

---

### 3. Useful Queries

**Find user by email:**
```sql
SELECT id, username, email, oauth_provider, google_id FROM users 
WHERE email = 'alice@test.com';
```

**Check OAuth setup:**
```sql
SELECT id, username, email, google_id, oauth_provider, oauth_last_login FROM users 
WHERE google_id IS NOT NULL;
```

**View all friend requests:**
```sql
SELECT fr.id, u1.username as sender, u2.username as receiver, fr.status, fr.created_at
FROM friend_requests fr
JOIN users u1 ON fr.sender_id = u1.id
JOIN users u2 ON fr.receiver_id = u2.id
ORDER BY fr.created_at DESC;
```

**Get diary entry collaborators:**
```sql
SELECT de.title, u.username, c.role, c.status, c.invited_at
FROM collaborators c
JOIN users u ON c.user_id = u.id
JOIN diary_entries de ON c.entry_id = de.id
ORDER BY c.invited_at DESC;
```

**View user activity:**
```sql
SELECT user_id, action, entity_type, created_at FROM activity_log
WHERE user_id = 'user_1'
ORDER BY created_at DESC LIMIT 20;
```

---

## Troubleshooting

### Issue: "Connection refused" Error

**Symptom:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solutions:**

1. **Check if container is running:**
   ```bash
   docker compose ps
   ```
   If postgres isn't running, start it:
   ```bash
   docker compose up -d postgres
   ```

2. **Check if port 5432 is available:**
   ```bash
   lsof -i :5432  # See what's using port
   ```

3. **Verify PostgreSQL is healthy:**
   ```bash
   docker compose logs postgres | tail -20
   ```

---

### Issue: "Database auth_db does not exist"

**Cause:** PostgreSQL started but migrations haven't run yet.

**Solution:**
```bash
# Wait a few seconds for migrations to complete
sleep 10

# Verify database exists
docker compose exec postgres psql -U postgres -l
```

---

### Issue: Migration Failed

**Symptom:** Container logs show SQL errors

**Solution:**

1. Check logs:
   ```bash
   docker compose logs postgres | grep -i error
   ```

2. Fix the migration file (if needed)

3. Rebuild:
   ```bash
   docker compose down -v
   docker compose up -d
   ```

---

### Issue: Wrong Database User/Password

**Symptom:** Auth service can't connect

**Fix:**

1. Update docker-compose.yml environment variables
2. Rebuild:
   ```bash
   docker compose down -v
   docker compose up -d --build
   ```

---

## Backup & Recovery

### Backup Database

```bash
# Full dump
docker compose exec postgres pg_dump -U postgres -d auth_db > backup.sql

# With compression
docker compose exec postgres pg_dump -U postgres -d auth_db | gzip > backup.sql.gz
```

### Restore from Backup

```bash
# Stop the container
docker compose down

# Clear the volume
docker volume rm infrastructure_postgres_data  # If using volumes

# Start fresh
docker compose up -d

# Wait for migrations
sleep 5

# Restore (optional, if you had a backup)
docker compose exec -T postgres psql -U postgres -d auth_db < backup.sql
```

---

## Data Reset for Development

### Clear All Data (Keep Schema)

```sql
-- Delete all data in order (respect foreign keys)
TRUNCATE TABLE oauth_tokens CASCADE;
TRUNCATE TABLE notifications CASCADE;
TRUNCATE TABLE activity_log CASCADE;
TRUNCATE TABLE collaborators CASCADE;
TRUNCATE TABLE friend_requests CASCADE;
TRUNCATE TABLE friends CASCADE;
TRUNCATE TABLE diary_entries CASCADE;
TRUNCATE TABLE ws_connections CASCADE;
TRUNCATE TABLE active_sessions CASCADE;
TRUNCATE TABLE users CASCADE;

-- Reinsert test users
INSERT INTO users (id, username, email, full_name, avatar, bio) VALUES
('user_1', 'alice', 'alice@test.com', 'Alice Johnson', 'https://i.pravatar.cc/150?u=alice', 'Love writing diaries!'),
('user_2', 'bob', 'bob@test.com', 'Bob Smith', 'https://i.pravatar.cc/150?u=bob', 'Diary enthusiast'),
('user_3', 'charlie', 'charlie@test.com', 'Charlie Brown', 'https://i.pravatar.cc/150?u=charlie', 'Writer and thinker');
```

### Full Reset (Rebuild Everything)

```bash
docker compose down -v
docker compose up -d
```

This removes the volume, forcing full re-initialization.

---

## Performance Tuning

### Check Slow Queries

```sql
-- View slow query log
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC LIMIT 10;
```

### Analyze Table Performance

```sql
ANALYZE users;
ANALYZE diary_entries;
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'alice@test.com';
```

### Reindex Tables

```sql
REINDEX INDEX idx_users_email;
REINDEX TABLE users;
```

---

## Production Considerations

### Security
- ❌ Change default password from `postgres`
- ✅ Use strong password (24+ chars, mixed case, numbers, symbols)
- ✅ Restrict database access (no public networks)
- ✅ Enable SSL connections

### Performance
- ✅ Set `max_connections` based on app needs
- ✅ Configure `shared_buffers` (25% of RAM)
- ✅ Enable WAL archiving for backups
- ✅ Run `VACUUM` and `ANALYZE` regularly

### Monitoring
- ✅ Monitor connection count
- ✅ Track query performance
- ✅ Alert on disk space usage
- ✅ Monitor transaction logs

---

## Useful Docker Commands

```bash
# View all database containers
docker compose ps

# Check database logs
docker compose logs postgres

# Real-time log streaming
docker compose logs -f postgres

# Database stats
docker compose exec postgres psql -U postgres -c "SELECT datname, pg_size_pretty(pg_database_size(datname)) FROM pg_database;"

# Restart database
docker compose restart postgres

# Full cleanup
docker compose down -v
```

---

## Authentication & Security

### Password Hashing
- Algorithm: bcrypt
- Salt rounds: 10
- Hash location: `users.password_hash`

### OAuth Tokens
- Location: `oauth_tokens` table
- Access token stored (encrypted in production)
- Refresh token for token renewal
- Expiry tracking in `token_expires_at`

### Session Management
- JWT tokens used instead of sessions
- Token stored in browser localStorage
- No session table needed (stateless)

---

## Common Admin Tasks

### Add Test User via SQL

```sql
INSERT INTO users (id, username, email, password_hash, full_name)
VALUES (
  'user_new', 
  'testuser', 
  'test@example.com', 
  '$2b$10$...', -- bcrypt hash
  'Test User'
);
```

### Manually Create OAuth Link

```sql
UPDATE users 
SET google_id = '123456789', oauth_provider = 'google'
WHERE id = 'user_1';
```

### Delete User (Cascade)

```sql
DELETE FROM users WHERE id = 'user_to_delete';
-- This cascades to oauth_tokens, activity_log, notifications, etc.
```

### Fix Data Inconsistencies

```sql
-- Remove orphaned oauth_tokens
DELETE FROM oauth_tokens 
WHERE user_id NOT IN (SELECT id FROM users);

-- Find users without username
SELECT id FROM users WHERE username IS NULL;

-- Find duplicate emails (shouldn't exist with constraint)
SELECT email, COUNT(*) FROM users GROUP BY email HAVING COUNT(*) > 1;
```

---

**Document Version:** 1.0  
**Last Updated:** February 13, 2026  
**Database:** PostgreSQL 16
