const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'auth_db',
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
});

pool.on('connect', () => {
  console.log('Connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error', err);
});

// Helper wrapper methods for database operations
const run = (text, params, callback) => {
  const args = Array.isArray(params) ? params : [];
  const cb = typeof params === 'function' ? params : callback;

  return pool
    .query(text, args)
    .then((result) => {
      if (cb) {
        cb.call({ changes: result.rowCount, lastID: result.rows?.[0]?.id }, null);
      }
      return result;
    })
    .catch((err) => {
      if (cb) {
        cb(err);
        return null;
      }
      throw err;
    });
};

const get = (text, params, callback) => {
  const args = Array.isArray(params) ? params : [];
  const cb = typeof params === 'function' ? params : callback;

  return pool
    .query(text, args)
    .then((result) => {
      const row = result.rows[0] || null;
      if (cb) cb(null, row);
      return row;
    })
    .catch((err) => {
      if (cb) {
        cb(err);
        return null;
      }
      throw err;
    });
};

const all = (text, params, callback) => {
  const args = Array.isArray(params) ? params : [];
  const cb = typeof params === 'function' ? params : callback;

  return pool
    .query(text, args)
    .then((result) => {
      if (cb) cb(null, result.rows);
      return result.rows;
    })
    .catch((err) => {
      if (cb) {
        cb(err);
        return null;
      }
      throw err;
    });
};

module.exports = {
  pool,
  query: pool.query.bind(pool),
  run,
  get,
  all,
};
