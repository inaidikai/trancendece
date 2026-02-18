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


const run = async (text, params = []) => {
  const args = Array.isArray(params) ? params : [];
  try {
    const result = await pool.query(text, args);
    return {
      changes: result.rowCount,
      lastID: result.rows?.[0]?.id,
      result,
    };
  } catch (err) {
    throw err;
  }
};

const get = async (text, params = []) => {
  const args = Array.isArray(params) ? params : [];
  try {
    const result = await pool.query(text, args);
    return result.rows[0] || null;
  } catch (err) {
    throw err;
  }
};

const all = async (text, params = []) => {
  const args = Array.isArray(params) ? params : [];
  try {
    const result = await pool.query(text, args);
    return result.rows;
  } catch (err) {
    throw err;
  }
};

module.exports = {
  pool,
  query: pool.query.bind(pool),
  run,
  get,
  all,
};
