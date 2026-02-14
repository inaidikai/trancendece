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
const DB_RETRY_ATTEMPTS = Number(process.env.DB_RETRY_ATTEMPTS || 30);
const DB_RETRY_DELAY_MS = Number(process.env.DB_RETRY_DELAY_MS || 2000);
const REQUEST_BODY_LIMIT = process.env.DIARY_REQUEST_BODY_LIMIT || '10mb';
const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

function normalizeOrigin(origin) {
  return (origin || '').trim().replace(/\/+$/, '');
}

function getAllowedOrigins() {
  const rawOrigins = process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '';
  const configured = rawOrigins
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);

  return configured.length ? configured : DEFAULT_ALLOWED_ORIGINS;
}

const allowedOrigins = getAllowedOrigins();
const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const normalizedOrigin = normalizeOrigin(origin);
    if (allowedOrigins.includes(normalizedOrigin)) return callback(null, true);
    return callback(new Error(`CORS origin denied: ${origin}`));
  },
  credentials: true,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableDbError = (err) => {
  const code = err && err.code;
  return (
    code === '57P03' || // DB is starting up
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'ETIMEDOUT'
  );
};

async function waitForDatabaseReady() {
  for (let attempt = 1; attempt <= DB_RETRY_ATTEMPTS; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (error) {
      if (!isRetryableDbError(error) || attempt === DB_RETRY_ATTEMPTS) {
        throw error;
      }
      console.warn(
        `Diary DB not ready (${error.code || error.message}); retry ${attempt}/${DB_RETRY_ATTEMPTS} in ${DB_RETRY_DELAY_MS}ms`
      );
      await sleep(DB_RETRY_DELAY_MS);
    }
  }
}

// Middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: REQUEST_BODY_LIMIT }));

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
    ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS connected_at TIMESTAMP NOT NULL DEFAULT NOW()
  `);

  await pool.query(`
    ALTER TABLE ws_connections
    ALTER COLUMN is_online SET DEFAULT FALSE
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
    ADD COLUMN IF NOT EXISTS diary_type TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW()
  `);

  await pool.query(`
    UPDATE diary_entries
    SET diary_type = CASE WHEN is_private THEN 'private' ELSE 'collaborative' END
    WHERE diary_type IS NULL
  `);

  await pool.query(`
    ALTER TABLE diary_entries
    ALTER COLUMN diary_type SET DEFAULT 'private'
  `);

  await pool.query(`
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
  `);

  await pool.query(`
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
  `);

  await pool.query(`
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
  `);

  await pool.query(`
    DROP TRIGGER IF EXISTS trg_enforce_single_diary_type_per_owner ON diary_entries
  `);

  await pool.query(`
    CREATE TRIGGER trg_enforce_single_diary_type_per_owner
    BEFORE INSERT OR UPDATE OF owner_id, diary_type, is_private
    ON diary_entries
    FOR EACH ROW
    EXECUTE FUNCTION enforce_single_diary_type_per_owner()
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
  `);

  await pool.query(`
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
  `);

  await pool.query(`
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
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
    ON notifications (recipient_id, created_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
    ON notifications (recipient_id, is_read, is_archived)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_diary_entries_owner_updated
    ON diary_entries (owner_id, updated_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_diary_entries_owner_type
    ON diary_entries (owner_id, diary_type)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_activity_log_user_created
    ON activity_log (user_id, created_at DESC)
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
    await waitForDatabaseReady();
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
