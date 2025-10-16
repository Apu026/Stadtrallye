(async()=>{
  try{
    const db = require('./lib/db');
    console.log('dbEnabled=', db.dbEnabled);
    if(!db.dbEnabled){ console.log('DB not enabled (check .env)'); process.exit(0); }
    const t = await db.pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
    console.log('tables:', t.rows.map(r=>r.table_name));
    const sg = await db.pool.query('SELECT * FROM sessiongroups LIMIT 5');
    console.log('sessiongroups sample:', sg.rows);
    process.exit(0);
  }catch(e){
    console.error('ERROR:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
})();
