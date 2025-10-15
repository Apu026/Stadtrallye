// Clean Express server for development with optional Postgres support
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
let Pool;
try { Pool = require('pg').Pool; } catch (e) { Pool = null; }

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

let pool = null;
let dbEnabled = false;
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
}

// load sample POIs for fallback
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

app.get('/api/health', async (req, res) => {
  if (dbEnabled) {
    try { await pool.query('SELECT 1'); return res.json({ ok: true, db: true }); }
    catch (e) { return res.json({ ok: true, db: false, error: e.message }); }
  }
  res.json({ ok: true, db: false });
});

// Simple login endpoint for development
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    // If DB available, attempt a simple lookup (non-strict) otherwise fallback to dev logic
    if (dbEnabled) {
      try {
        const q = await pool.query('SELECT name, role FROM users WHERE name = $1 LIMIT 1', [username]);
        if (q.rows.length === 0) return res.status(401).json({ success: false, error: 'User not found' });
        const user = q.rows[0];
        return res.json({ success: true, role: user.role || 'user' });
      } catch (e) {
        console.warn('DB login fallback failed, using dev-login:', e.message || e);
      }
    }

    // Dev fallback: special usernames -> roles
    if (!username) return res.status(400).json({ success: false, error: 'username required' });
    if (username.toLowerCase().includes('super')) return res.json({ success: true, role: 'superadmin' });
    if (username.toLowerCase().includes('admin')) return res.json({ success: true, role: 'admin' });
    if (username.toLowerCase().includes('closed')) return res.json({ success: true, role: 'closed' });
    // generic success for others (dev only)
    return res.json({ success: true, role: 'user' });
  } catch (e) {
    console.error('Error in /api/login', e);
    res.status(500).json({ success: false, error: 'server error' });
  }
});

app.get('/api/pois', async (req, res) => {
  if (dbEnabled) {
    try {
      const q = `SELECT poi_id AS id, poi_name AS name, coords_lat AS lat, coords_lng AS lng, radius_meters AS radius, description FROM pois ORDER BY poi_id`;
      const r = await pool.query(q);
      return res.json({ pois: r.rows.map(row => ({ id: row.id, name: row.name, coords: [Number(row.lat), Number(row.lng)], radiusMeters: Number(row.radius), description: row.description })) });
    } catch (e) {
      console.warn('DB query for POIs failed, returning sample data instead:', e.message || e);
      return res.json({ pois: samplePois });
    }
  }
  res.json({ pois: samplePois });
});

app.post('/api/pois', (req, res) => {
  const poi = req.body;
  poi.id = poi.id || `tmp-${Date.now()}`;
  samplePois.push(poi);
  res.json({ poi });
});

function generateRoomCode(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

app.get('/api/rooms/check/:code', async (req, res) => {
  if (!dbEnabled) return res.json({ exists: false });
  try {
    const { code } = req.params;
    console.log('[rooms/check] received code=', JSON.stringify(code));
    const r = await pool.query(
      `SELECT session_id AS id, rallye_id, TRIM(status) AS status, entry_code AS code
       FROM session
       WHERE UPPER(entry_code) = UPPER($1)
       AND UPPER(TRIM(status)) IN ('OFFEN','OPEN','GESTARTET')
       LIMIT 1`,
      [code]
    );
    console.log('[rooms/check] db rows=', r.rows.length ? JSON.stringify(r.rows[0]) : 'none');
    if (r.rows.length > 0) return res.json({ exists: true, rallye_id: r.rows[0].rallye_id, status: r.rows[0].status, code: r.rows[0].code, id: r.rows[0].id });
    res.json({ exists: false });
  } catch (e) {
    console.error('Error in /api/rooms/check:', e);
    res.status(500).json({ error: 'Fehler beim Prüfen des Raumcodes' });
  }
});

app.post('/api/rooms/:roomCode/join-group', async (req, res) => {
  if (!dbEnabled) return res.status(500).json({ error: 'DB not enabled' });
  const client = await pool.connect();
  try {
    const { roomCode } = req.params;
    const { groupName } = req.body;
    if (!groupName) return res.status(400).json({ error: 'Gruppenname fehlt' });

    const s = await client.query('SELECT session_id FROM session WHERE entry_code = $1', [roomCode]);
    if (s.rows.length === 0) return res.status(404).json({ error: 'Raum nicht gefunden' });
    const sessionId = s.rows[0].session_id;

    let g = await client.query('SELECT group_id FROM groups WHERE group_name = $1', [groupName]);
    let groupId;
    if (g.rows.length === 0) {
      const newG = await client.query('INSERT INTO groups (group_name) VALUES ($1) RETURNING group_id', [groupName]);
      groupId = newG.rows[0].group_id;
    } else {
      groupId = g.rows[0].group_id;
    }

    const existing = await client.query('SELECT * FROM sessiongroups WHERE session_id = $1 AND group_id = $2', [sessionId, groupId]);
    if (existing.rows.length > 0) return res.json({ success: true, message: 'Gruppe war bereits in dieser Session aktiv' });

    const insert = await client.query('INSERT INTO sessiongroups (session_id, group_id, points, finished) VALUES ($1,$2,0,false) RETURNING *', [sessionId, groupId]);
    res.json({ success: true, created: true, sessionGroup: insert.rows[0] });
  } catch (e) {
    console.error('Fehler in /join-group:', e);
    res.status(500).json({ error: 'Fehler beim Beitreten zur Gruppe' });
  } finally {
    client.release();
  }
});

app.get('/api/rooms/:roomCode/taken-groups', async (req, res) => {
  if (!dbEnabled) return res.json({ takenGroups: [] });
  try {
    const { roomCode } = req.params;
    const s = await pool.query('SELECT session_id FROM session WHERE entry_code = $1', [roomCode]);
    if (s.rows.length === 0) return res.status(404).json({ error: 'Raum nicht gefunden' });
    const sessionId = s.rows[0].session_id;
    const r = await pool.query(`SELECT g.group_name FROM sessiongroups sg JOIN groups g ON g.group_id = sg.group_id WHERE sg.session_id = $1`, [sessionId]);
    res.json({ takenGroups: r.rows.map(row => row.group_name) });
  } catch (e) {
    console.error('Fehler beim Laden der vergebenen Gruppen', e);
    res.status(500).json({ error: 'Fehler beim Laden der vergebenen Gruppen' });
  }
});

app.get('/api/group-names', async (req, res) => {
  if (!dbEnabled) return res.json({ groupNames: [] });
  try {
    const r = await pool.query('SELECT group_id, group_name FROM groups ORDER BY group_name ASC');
    res.json({ groupNames: r.rows });
  } catch (e) {
    console.error('Fehler in /api/group-names:', e);
    res.status(500).json({ error: 'Fehler beim Laden der Gruppennamen' });
  }
});

app.post('/api/rooms/:roomCode/finish', async (req, res) => {
  try {
    const { roomCode } = req.params;
    if (!dbEnabled || !pool) return res.json({ success: true, message: 'DB not enabled, no-op' });
    const s = await pool.query('SELECT session_id FROM session WHERE entry_code = $1', [roomCode]);
    if (s.rows.length === 0) return res.status(404).json({ error: 'Raum nicht gefunden' });
    const sessionId = s.rows[0].session_id;
    await pool.query('UPDATE sessiongroups SET finished = true WHERE session_id = $1', [sessionId]);
    await pool.query('UPDATE session SET status = $1 WHERE session_id = $2', ['geschlossen', sessionId]);
    res.json({ success: true });
  } catch (e) {
    console.error('Fehler beim Beenden der Session:', e);
    res.status(500).json({ error: 'Fehler beim Beenden der Session' });
  }
});

app.get('/api/sessiongroups', async (req, res) => {
  if (!dbEnabled) return res.json([]);
  try {
    const { roomCode } = req.query;
    if (roomCode) {
      const s = await pool.query('SELECT session_id FROM session WHERE entry_code = $1', [roomCode]);
      if (s.rows.length === 0) return res.status(404).json({ error: 'Raum nicht gefunden' });
      const sessionId = s.rows[0].session_id;
      const r = await pool.query(`SELECT sg.session_id, sg.group_id, sg.points, sg.finished, g.group_name FROM sessiongroups sg JOIN groups g ON g.group_id = sg.group_id WHERE sg.session_id = $1`, [sessionId]);
      return res.json(r.rows);
    } else {
      const r = await pool.query(`SELECT sg.session_id, sg.group_id, sg.points, sg.finished, g.group_name FROM sessiongroups sg JOIN groups g ON g.group_id = sg.group_id`);
      return res.json(r.rows);
    }
  } catch (e) {
    console.error('Fehler in /api/sessiongroups:', e);
    res.status(500).json({ error: 'Fehler beim Laden der Sessiongroups' });
  }
});

// DEBUG: list sessions (dev only)
app.get('/api/debug/sessions', async (req, res) => {
  if (!dbEnabled) return res.status(500).json({ error: 'DB not enabled' });
  try {
    const r = await pool.query("SELECT session_id, entry_code, TRIM(status) AS status, rallye_id FROM session ORDER BY session_id DESC LIMIT 200");
    res.json({ sessions: r.rows });
  } catch (e) {
    console.error('Debug sessions failed', e);
    res.status(500).json({ error: 'failed' });
  }
});

// DEBUG: lookup session by entry code
app.get('/api/debug/session/:code', async (req, res) => {
  if (!dbEnabled) return res.status(500).json({ error: 'DB not enabled' });
  try {
    const { code } = req.params;
    const r = await pool.query("SELECT session_id, entry_code, TRIM(status) AS status, rallye_id FROM session WHERE UPPER(entry_code)=UPPER($1) LIMIT 1", [code]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'not found' });
    res.json({ session: r.rows[0] });
  } catch (e) {
    console.error('Debug session failed', e);
    res.status(500).json({ error: 'failed' });
  }
});

// Admin listing of all rooms (sessions) — used by admin UI
app.get('/api/rooms/all', async (req, res) => {
  if (!dbEnabled) return res.json({ rooms: [] });
  try {
    const r = await pool.query("SELECT session_id AS id, entry_code AS code, TRIM(status) AS status, rallye_id FROM session ORDER BY session_id DESC");
    res.json({ rooms: r.rows });
  } catch (e) {
    console.error('Error in /api/rooms/all:', e);
    res.status(500).json({ error: 'Fehler beim Laden der Räume' });
  }
});

// Rallye list for admin UI
app.get('/api/rallyes', async (req, res) => {
  if (!dbEnabled) return res.json({ rallyes: [] });
  try {
    const r = await pool.query('SELECT rallye_id AS id, name FROM rallye ORDER BY name ASC');
    res.json({ rallyes: r.rows });
  } catch (e) {
    console.error('Error in /api/rallyes:', e);
    res.status(500).json({ error: 'Fehler beim Laden der Rallyes' });
  }
});

// Create a new room (session) for a rallye
app.post('/api/rooms', async (req, res) => {
  const { rallye_id } = req.body || {};
  if (!dbEnabled) return res.status(500).json({ error: 'DB not enabled' });
  try {
    // generate a unique entry code
    const code = generateRoomCode(6);
    const insert = await pool.query('INSERT INTO session (entry_code, status, rallye_id) VALUES ($1,$2,$3) RETURNING session_id, entry_code, TRIM(status) AS status, rallye_id', [code, 'offen', rallye_id || null]);
    const room = insert.rows[0];
    res.status(201).json({ room: { id: room.session_id, code: room.entry_code, status: room.status, rallye_id: room.rallye_id } });
  } catch (e) {
    console.error('Error creating room:', e);
    res.status(500).json({ error: 'Fehler beim Erstellen des Raums' });
  }
});

// Start a room (set status to 'gestartet')
app.patch('/api/rooms/:id/start', async (req, res) => {
  if (!dbEnabled) return res.status(500).json({ error: 'DB not enabled' });
  try {
    const id = req.params.id;
    const r = await pool.query('UPDATE session SET status = $1 WHERE session_id = $2 RETURNING session_id, entry_code, TRIM(status) AS status, rallye_id', ['gestartet', id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Raum nicht gefunden' });
    res.json({ room: { id: r.rows[0].session_id, code: r.rows[0].entry_code, status: r.rows[0].status, rallye_id: r.rows[0].rallye_id } });
  } catch (e) {
    console.error('Error starting room:', e);
    res.status(500).json({ error: 'Fehler beim Starten des Raums' });
  }
});

// Close a room (set status to 'geschlossen')
app.patch('/api/rooms/:id/close', async (req, res) => {
  if (!dbEnabled) return res.status(500).json({ error: 'DB not enabled' });
  try {
    const id = req.params.id;
    const r = await pool.query('UPDATE session SET status = $1 WHERE session_id = $2 RETURNING session_id, entry_code, TRIM(status) AS status, rallye_id', ['geschlossen', id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Raum nicht gefunden' });
    res.json({ room: { id: r.rows[0].session_id, code: r.rows[0].entry_code, status: r.rows[0].status, rallye_id: r.rows[0].rallye_id } });
  } catch (e) {
    console.error('Error closing room:', e);
    res.status(500).json({ error: 'Fehler beim Schließen des Raums' });
  }
});

// Delete a room
app.delete('/api/rooms/:id', async (req, res) => {
  if (!dbEnabled) return res.status(500).json({ error: 'DB not enabled' });
  try {
    const id = req.params.id;
    // delete sessiongroups first to maintain FK integrity
    await pool.query('DELETE FROM sessiongroups WHERE session_id = $1', [id]);
    const r = await pool.query('DELETE FROM session WHERE session_id = $1 RETURNING session_id', [id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Raum nicht gefunden' });
    res.json({ success: true });
  } catch (e) {
    console.error('Error deleting room:', e);
    res.status(500).json({ error: 'Fehler beim Löschen des Raums' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server läuft auf Port ${PORT}`));
