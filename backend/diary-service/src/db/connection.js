const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@db:5432/lola',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  console.log('📊 Diary Service: Database connected successfully');
});

pool.on('error', (err) => {
  console.error('❌ Diary Service: Unexpected database error:', err);
  process.exit(-1);
});

module.exports = pool;