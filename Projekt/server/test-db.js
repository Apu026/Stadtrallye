require('dotenv').config();
const { Pool } = require('pg');

const useSsl = (process.env.PGSSLMODE && process.env.PGSSLMODE.toLowerCase() !== 'disable');

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 5000,
});

async function testConnection() {
  let client;
  try {
    client = await pool.connect();
    const { rows } = await client.query('SELECT current_database() AS db, inet_client_addr() AS client_addr');
    console.log('Connected to DB:', rows[0].db, 'client_addr:', rows[0].client_addr);
    const t = await client.query(`SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY table_schema, table_name LIMIT 20`);
    console.log('Tables:', t.rows.map(r => `${r.table_schema}.${r.table_name}`).join(', '));
    client.release();
    await pool.end();
    process.exit(0);
  } catch (err) {
    if (client) try { client.release(); } catch (_) {}
    console.error('Fehler bei der Verbindung:', err && err.stack ? err.stack : err);
    try { await pool.end(); } catch (_) {}
    process.exit(1);
  }
}
testConnection();