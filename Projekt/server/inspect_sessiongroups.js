(async () => {
  try {
    const db = require('./lib/db');
    if (!db.dbEnabled) {
      console.log('DB not enabled');
      process.exit(0);
    }
    const cols = await db.pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'sessiongroups' ORDER BY ordinal_position");
    console.log('columns:', cols.rows.map(r=>r.column_name));
    const sample = await db.pool.query('SELECT * FROM sessiongroups LIMIT 5');
    console.log('sample rows:', sample.rows);
    process.exit(0);
  } catch (e) {
    console.error('ERROR', e.message);
    console.error(e.stack);
    process.exit(1);
  }
})();
