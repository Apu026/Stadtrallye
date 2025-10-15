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
app.use(cors()); // CORS für API erlauben
app.use(express.json()); // JSON-Body-Parsing


// Verbindung zur PostgreSQL-Datenbank herstellen
const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT ? parseInt(process.env.PGPORT) : 5432, //Fallback auf 5432 wenn PGPORT nicht gesetzt ist
});

// Gibt alle Nutzer zurück (Nutzerverwaltung)
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT user_id, name, role FROM users ORDER BY name ASC');
    res.json({ users: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden der Nutzer' });
  }
});

// Nutzer anlegen (Superadmin)
app.post('/api/users', async (req, res) => {
  try {
    const { name, role, password } = req.body || {};
    if (!name || !role || !password) {
      return res.status(400).json({ error: 'name, role und password sind erforderlich' });
    }
    // Prüfe, ob Name bereits existiert
    const exists = await pool.query('SELECT 1 FROM users WHERE name = $1', [name]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'Benutzername bereits vergeben' });
    }
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (name, role, password) VALUES ($1, $2, $3) RETURNING user_id, name, role',
      [name, role, hash]
    );
    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Anlegen des Nutzers' });
  }
});

// Nutzer aktualisieren (Superadmin)
app.patch('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, password } = req.body || {};
    // Prüfen, ob Nutzer existiert
    const userRes = await pool.query('SELECT user_id, name, role FROM users WHERE user_id = $1', [id]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'Nutzer nicht gefunden' });

    // Wenn name geändert werden soll, prüfen auf Kollision
    if (name) {
      const nameRes = await pool.query('SELECT 1 FROM users WHERE name = $1 AND user_id <> $2', [name, id]);
      if (nameRes.rows.length > 0) return res.status(409).json({ error: 'Benutzername bereits vergeben' });
    }

    // Dynamisches Update zusammenbauen
    const fields = [];
    const values = [];
    let idx = 1;
    if (name) { fields.push(`name = $${idx++}`); values.push(name); }
    if (role) { fields.push(`role = $${idx++}`); values.push(role); }
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      fields.push(`password = $${idx++}`);
      values.push(hash);
    }
    if (fields.length === 0) {
      return res.status(400).json({ error: 'Keine änderbaren Felder übergeben' });
    }
    values.push(id);
    const query = `UPDATE users SET ${fields.join(', ')} WHERE user_id = $${idx} RETURNING user_id, name, role`;
    const updateRes = await pool.query(query, values);
    res.json({ user: updateRes.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Nutzers' });
  }
});

// Nutzer löschen (Superadmin)
app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const del = await pool.query('DELETE FROM users WHERE user_id = $1 RETURNING user_id, name, role', [id]);
    if (del.rows.length === 0) return res.status(404).json({ error: 'Nutzer nicht gefunden' });
    res.json({ success: true, user: del.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Löschen des Nutzers' });
  }
});


// Simple login endpoint for development
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE name = $1', [username]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'User not found' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Wrong password' });

    res.json({ success: true, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
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
    const result = await pool.query('SELECT rallye_id, name, beschreibung FROM rallye ORDER BY name ASC');
    res.json({ rallyes: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden der Rallyes' });
  }
});

// Erstellt eine neue Session (Raum)
app.post('/api/rooms', async (req, res) => {
  try {
    let code;
    let exists = true;
    while (exists) {
      code = generateRoomCode();
      const check = await pool.query('SELECT 1 FROM session WHERE entry_code = $1', [code]);
      exists = check.rows.length > 0;
    }
    const { rallye_id } = req.body;
    if (!rallye_id) {
      return res.status(400).json({ error: 'rallye_id ist erforderlich' });
    }
    const result = await pool.query(
      'INSERT INTO session (entry_code, status, rallye_id) VALUES ($1, $2, $3) RETURNING *',
      [code, 'offen', rallye_id]
    );
    res.json({ room: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Erstellen der Session' });
  }
});


// Gibt alle offenen Sessions zurück
app.get('/api/rooms', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM session WHERE status = $1', ['offen']);
    res.json({ rooms: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden der Sessions' });
  }
});

// Gibt alle Sessions zurück (offen und geschlossen)
app.get('/api/rooms/all', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM session');
    res.json({ rooms: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden aller Sessions' });
  }
});

// Schließt eine Session (Status auf "geschlossen")
app.patch('/api/rooms/:id/close', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE session SET status = $1 WHERE session_id = $2 RETURNING *',
      ['geschlossen', id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Session nicht gefunden' });
    res.json({ room: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Schließen der Session' });
  }
});


// Löscht eine Session anhand der ID
app.delete('/api/rooms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Zuerst alle zugehörigen sessiongroups-Einträge löschen
    await pool.query('DELETE FROM sessiongroups WHERE session_id = $1', [id]);
    // Dann die Session selbst löschen
    const result = await pool.query('DELETE FROM session WHERE session_id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Session nicht gefunden' });
    res.json({ success: true, deletedRoom: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Löschen der Session' });
  }
});

// Gibt alle Gruppen zurück
app.get('/api/group-names', async (req, res) => {
  try {
    const result = await pool.query('SELECT group_id, group_name FROM groups ORDER BY group_name ASC');
    res.json({ groupNames: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden der Gruppen' });
  }
});

// Prüft, ob eine Session mit Code existiert und offen ist
app.get('/api/rooms/check/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const result = await pool.query('SELECT * FROM session WHERE entry_code = $1 AND status = $2', [code, 'offen']);
    res.json({ exists: result.rows.length > 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Prüfen des Session-Codes' });
  }
});

// Gibt Session-Info per Code zurück (z.B. für Warteseite)
app.get('/api/rooms/code/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const result = await pool.query('SELECT * FROM session WHERE entry_code = $1', [code]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Session nicht gefunden' });
    res.json({ room: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden der Session' });
  }
});

// Gibt alle vergebenen Gruppennamen für eine Session zurück
app.get('/api/rooms/:roomCode/taken-groups', async (req, res) => {
  try {
    const { roomCode } = req.params;
    // Hole die session_id zum Code
    const sessionResult = await pool.query('SELECT session_id FROM session WHERE entry_code = $1', [roomCode]);
    if (sessionResult.rows.length === 0) return res.status(404).json({ error: 'Session nicht gefunden' });
    const sessionId = sessionResult.rows[0].session_id;
    // Hole alle vergebenen Gruppennamen für diese Session über sessiongroups
    const takenResult = await pool.query(`
      SELECT g.group_name FROM groups g
      JOIN sessiongroups sg ON g.group_id = sg.group_id
      WHERE sg.session_id = $1
    `, [sessionId]);
    const takenGroups = takenResult.rows.map(row => row.group_name);
    res.json({ takenGroups });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden der vergebenen Gruppennamen' });
  }
});

// Spieler tritt einer Gruppe in einer Session bei
app.post('/api/rooms/:roomCode/join-group', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { groupName } = req.body;
    if (!groupName) return res.status(400).json({ error: 'Gruppenname fehlt' });
  // Hole die session_id zum Code
  const sessionResult = await pool.query('SELECT session_id FROM session WHERE entry_code = $1', [roomCode]);
  if (sessionResult.rows.length === 0) return res.status(404).json({ error: 'Session nicht gefunden' });
  const sessionId = sessionResult.rows[0].session_id;
  // Prüfe, ob der Gruppenname schon vergeben ist (über sessiongroups)
  const groupResult = await pool.query('SELECT group_id FROM groups WHERE group_name = $1', [groupName]);
  if (groupResult.rows.length === 0) return res.status(404).json({ error: 'Gruppe nicht gefunden' });
  const groupId = groupResult.rows[0].group_id;
  const taken = await pool.query('SELECT 1 FROM sessiongroups WHERE session_id = $1 AND group_id = $2', [sessionId, groupId]);
  if (taken.rows.length > 0) return res.status(409).json({ error: 'Gruppenname bereits vergeben' });
  // Eintrag anlegen
  await pool.query('INSERT INTO sessiongroups (session_id, group_id) VALUES ($1, $2)', [sessionId, groupId]);
  res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Beitreten zur Gruppe' });
  }
});

// Setzt den Status einer Session auf 'gestartet'
app.patch('/api/rooms/:id/start', async (req, res) => {
  if (!dbEnabled) return res.status(500).json({ error: 'DB not enabled' });
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE session SET status = $1 WHERE session_id = $2 RETURNING *',
      ['gestartet', id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Session nicht gefunden' });
    res.json({ room: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Starten der Session' });
  }
});

// Gibt die rallye_id einer Session per entry_code zurück
app.get('/api/rooms/:code/rallye-id', async (req, res) => {
  try {
    const { code } = req.params;
    const result = await pool.query('SELECT rallye_id FROM session WHERE entry_code = $1', [code]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Session nicht gefunden' });
    res.json({ rallye_id: result.rows[0].rallye_id });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Abrufen der Rallye-ID' });
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
