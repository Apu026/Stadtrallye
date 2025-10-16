// Shared DB module: exports pool, dbEnabled and samplePois
const fs = require('fs');
const path = require('path');
let Pool;
try { Pool = require('pg').Pool; } catch (e) { Pool = null; }
let pool = null;
let dbEnabled = false;

// load sample POIs for fallback (dev)
let samplePois = [];
try {
  const samplePath = path.resolve(__dirname, '..', 'my-app', 'src', 'data', 'pois.sample.json');
  if (fs.existsSync(samplePath)) {
    samplePois = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
    console.log('Loaded sample POIs:', samplePois.length);
  }
} catch (e) {
  console.warn('Could not load sample POIs:', e.message || e);
}

if (Pool && process.env.PGHOST && process.env.PGDATABASE) {
  try {
    pool = new Pool({
      user: process.env.PGUSER,
      host: process.env.PGHOST,
      database: process.env.PGDATABASE,
      password: process.env.PGPASSWORD,
      port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
      ssl: process.env.PGSSLMODE ? { rejectUnauthorized: process.env.PGSSLMODE !== 'disable' } : false,
    });
    dbEnabled = true;
    console.log('DB pooling enabled');
  } catch (e) {
    console.warn('Failed initializing DB pool, continuing without DB:', e.message || e);
    dbEnabled = false;
  }
} else {
  console.log('DB not enabled (missing pg or env), running with sample data only');
}

module.exports = { pool, dbEnabled, samplePois };
