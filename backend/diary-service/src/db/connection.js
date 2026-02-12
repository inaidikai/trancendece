const { Pool } = require('pg');
require('dotenv').config();

const connectionOptions = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
    }
  : {
      host: process.env.PGHOST || 'postgres',
      port: Number(process.env.PGPORT || 5432),
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      database: process.env.PGDATABASE || 'auth_db',
    };

const pool = new Pool({
  ...connectionOptions,
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
