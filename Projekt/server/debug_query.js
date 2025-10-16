// Simple DB debug script to inspect sessions
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
  ssl: process.env.PGSSLMODE ? { rejectUnauthorized: process.env.PGSSLMODE !== 'disable' } : false,
});

async function main() {
  const code = process.argv[2];
  try {
    if (code) {
      const r = await pool.query("SELECT session_id, entry_code, TRIM(status) AS status, rallye_id FROM session WHERE UPPER(entry_code)=UPPER($1) LIMIT 1", [code]);
      console.log(JSON.stringify({ rows: r.rows }, null, 2));
    } else {
      const r = await pool.query("SELECT session_id, entry_code, TRIM(status) AS status, rallye_id FROM session ORDER BY session_id DESC LIMIT 50");
      console.log(JSON.stringify({ rows: r.rows }, null, 2));
    }
  } catch (e) {
    console.error('DB query failed:', e.message || e);
    process.exit(2);
  } finally {
    await pool.end();
  }
}

main();
