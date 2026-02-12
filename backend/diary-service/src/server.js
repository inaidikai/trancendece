require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db/connection');

// Routes
const friendsRoutes = require('./routes/friends');
const notificationsRoutes = require('./routes/notifications');
const entriesRoutes = require('./routes/entries');
const collaboratorsRoutes = require('./routes/collaborators');
const usersRoutes = require('./routes/users');
const dashboardRoutes = require('./routes/dashboard');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/friends', friendsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/entries', entriesRoutes);
app.use('/api/collaborators', collaboratorsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// Start server
const PORT = Number(process.env.PORT || 8002);

async function ensureCoreTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS friends (
      user_id TEXT NOT NULL,
      friend_id TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, friend_id)
    )
  `);

  await pool.query(`
    ALTER TABLE friends
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW()
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS friend_requests (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL,
      receiver_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      message TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT unique_friend_request UNIQUE (sender_id, receiver_id),
      CONSTRAINT no_self_request CHECK (sender_id <> receiver_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ws_connections (
      user_id TEXT PRIMARY KEY,
      socket_id TEXT,
      last_seen TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE ws_connections
    ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS connected_at TIMESTAMP NOT NULL DEFAULT NOW()
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS diary_entries (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE diary_entries
    ADD COLUMN IF NOT EXISTS owner_id TEXT,
    ADD COLUMN IF NOT EXISTS title TEXT,
    ADD COLUMN IF NOT EXISTS cover_image TEXT,
    ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW()
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS collaborators (
      id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
      entry_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      invited_by TEXT NOT NULL,
      invited_at TIMESTAMP NOT NULL DEFAULT NOW(),
      accepted_at TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'pending',
      CONSTRAINT unique_collaboration UNIQUE (entry_id, user_id)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_collaborators_entry_status
    ON collaborators (entry_id, status)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_diary_entries_owner_updated
    ON diary_entries (owner_id, updated_at DESC)
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users'
      ) THEN
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS avatar_url TEXT;

        BEGIN
          EXECUTE 'UPDATE users SET avatar_url = COALESCE(avatar_url, avatar) WHERE avatar_url IS NULL';
        EXCEPTION WHEN undefined_column THEN
          -- users.avatar may not exist in some schemas
          NULL;
        END;
      END IF;
    END $$;
  `);
}

async function start() {
  try {
    await ensureCoreTables();
    app.listen(PORT, () => {
      console.log(`🚀 REST API server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start diary service:', error);
    process.exit(1);
  }
}

start();
