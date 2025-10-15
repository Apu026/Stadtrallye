// Unified CommonJS server file
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

dotenv.config();
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

// Detect DB config: only create Pool when PG env vars are set
let pool = null;
let dbEnabled = false;
if (process.env.PGHOST && process.env.PGDATABASE) {
  try {
    pool = new Pool({
      user: process.env.PGUSER,
      host: process.env.PGHOST,
      database: process.env.PGDATABASE,
      password: process.env.PGPASSWORD,
      port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
      // Note: for development behind self-signed certs you can set PGSSLMODE in .env
      ssl: process.env.PGSSLMODE ? { rejectUnauthorized: process.env.PGSSLMODE !== 'disable' } : false,
    });
    dbEnabled = true;
    console.log('DB pooling enabled');
  } catch (e) {
    console.warn('Failed to initialize DB pool, falling back to sample data', e.message);
    dbEnabled = false;
  }
}

// Load sample POIs from my-app if available (fallback when DB not configured)
let samplePois = [];
try {
  const samplePath = path.resolve(__dirname, '..', 'my-app', 'src', 'data', 'pois.sample.json');
  if (fs.existsSync(samplePath)) {
    const raw = fs.readFileSync(samplePath, 'utf8');
    samplePois = JSON.parse(raw);
    console.log('Loaded sample POIs:', samplePois.length);
  }
} catch (e) {
  console.warn('Could not read sample POIs:', e.message);
}

// Health endpoint
app.get('/api/health', async (req, res) => {
  if (dbEnabled) {
    try {
      await pool.query('SELECT 1');
      return res.json({ ok: true, db: true });
    } catch (e) {
      return res.json({ ok: true, db: false, error: e.message });
    }
  }
  res.json({ ok: true, db: false });
});

// Simple GET /api/pois — returns from DB if available, otherwise sample data
app.get('/api/pois', async (req, res) => {
  if (dbEnabled) {
    try {
      // Try to query a sensible shape; if schema differs this may error — catch and return sample instead
      const q = `SELECT poi_id AS id, poi_name AS name, coords_lat AS lat, coords_lng AS lng, radius_meters AS radius, description FROM pois ORDER BY poi_id`;
      const r = await pool.query(q);
      return res.json({ pois: r.rows });
    } catch (e) {
      console.warn('DB query for POIs failed, returning sample data instead:', e.message);
      return res.json({ pois: samplePois });
    }
  }
  res.json({ pois: samplePois });
});

// A minimal POST for creating POIs in-memory (development only)
app.post('/api/pois', (req, res) => {
  const poi = req.body;
  poi.id = poi.id || `tmp-${Date.now()}`;
  samplePois.push(poi);
  res.json({ poi });
});

// Serve nothing else — frontend runs separately via Vite. (Server will be started at the end of this file)

// -------------------- Hilfsfunktionen --------------------
function generateRoomCode(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// -------------------- Nutzerverwaltung --------------------
app.get("/api/users", async (_, res) => {
  try {
    const r = await pool.query(
      "SELECT user_id AS id, name AS username, role FROM users ORDER BY name ASC"
    );
    res.json({ users: r.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Fehler beim Laden der Nutzer" });
    const r = await pool.query(
      "SELECT user_id AS id, name AS username, role FROM users ORDER BY name ASC"
    );
    res.json({ users: r.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Fehler beim Laden der Nutzer" });
  }
});

app.post("/api/login", async (req, res) => {
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const r = await pool.query("SELECT * FROM users WHERE name = $1", [username]);
    if (r.rows.length === 0) return res.status(401).json({ error: "User not found" });
    const user = r.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Wrong password" });
    const r = await pool.query("SELECT * FROM users WHERE name = $1", [username]);
    if (r.rows.length === 0) return res.status(401).json({ error: "User not found" });
    const user = r.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Wrong password" });
    res.json({ success: true, role: user.role });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// -------------------- Rallyes --------------------
app.get("/api/rallyes", async (_, res) => {
  try {
    const r = await pool.query("SELECT rallye_id AS id, name FROM rallye ORDER BY name ASC");
    res.json({ rallyes: r.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Fehler beim Laden der Rallyes" });
  }
});

// -------------------- Räume / Sessions --------------------
app.get("/api/rooms", async (_, res) => {
  try {
    const r = await pool.query(
      "SELECT session_id AS id, rallye_id, entry_code AS code, status FROM session WHERE TRIM(status) = 'offen' ORDER BY session_id DESC"
    );
    res.json({ rooms: r.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Fehler beim Laden der Räume" });
  }
});

app.get("/api/rooms/all", async (_, res) => {
// -------------------- Rallyes --------------------
app.get("/api/rallyes", async (_, res) => {
  try {
    const r = await pool.query("SELECT rallye_id AS id, name FROM rallye ORDER BY name ASC");
    res.json({ rallyes: r.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Fehler beim Laden der Rallyes" });
  }
});

// -------------------- Räume / Sessions --------------------
app.get("/api/rooms", async (_, res) => {
  try {
    const r = await pool.query(
      "SELECT session_id AS id, rallye_id, entry_code AS code, status FROM session WHERE TRIM(status) = 'offen' ORDER BY session_id DESC"
    );
    res.json({ rooms: r.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Fehler beim Laden der Räume" });
  }
});

app.get("/api/rooms/all", async (_, res) => {
  try {
    const r = await pool.query(
      "SELECT session_id AS id, rallye_id, entry_code AS code, status FROM session ORDER BY session_id DESC"
    );
    res.json({ rooms: r.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Fehler beim Laden aller Räume" });
    const r = await pool.query(
      "SELECT session_id AS id, rallye_id, entry_code AS code, status FROM session ORDER BY session_id DESC"
    );
    res.json({ rooms: r.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Fehler beim Laden aller Räume" });
  }
});

app.post("/api/rooms", async (req, res) => {
app.post("/api/rooms", async (req, res) => {
  try {
    const { rallye_id } = req.body;
    if (!rallye_id) return res.status(400).json({ error: "rallye_id ist erforderlich" });

    let code, exists = true;
    const { rallye_id } = req.body;
    if (!rallye_id) return res.status(400).json({ error: "rallye_id ist erforderlich" });

    let code, exists = true;
    while (exists) {
      code = generateRoomCode();
      const check = await pool.query("SELECT 1 FROM session WHERE entry_code = $1", [code]);
      const check = await pool.query("SELECT 1 FROM session WHERE entry_code = $1", [code]);
      exists = check.rows.length > 0;
    }

    const r = await pool.query(
      "INSERT INTO session (entry_code, status, rallye_id) VALUES ($1,$2,$3) RETURNING session_id AS id, entry_code AS code, TRIM(status) AS status, rallye_id",
      [code, "offen", rallye_id]

    const r = await pool.query(
      "INSERT INTO session (entry_code, status, rallye_id) VALUES ($1,$2,$3) RETURNING session_id AS id, entry_code AS code, TRIM(status) AS status, rallye_id",
      [code, "offen", rallye_id]
    );
    res.json({ room: r.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Fehler beim Erstellen des Raums" });
    res.json({ room: r.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Fehler beim Erstellen des Raums" });
  }
});

app.patch("/api/rooms/:id/close", async (req, res) => {
app.patch("/api/rooms/:id/close", async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query(
      "UPDATE session SET status = $1 WHERE session_id = $2 RETURNING session_id AS id, entry_code AS code, TRIM(status) AS status",
      ["geschlossen", id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: "Raum nicht gefunden" });
    res.json({ room: r.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Fehler beim Schließen des Raums" });
    const { id } = req.params;
    const r = await pool.query(
      "UPDATE session SET status = $1 WHERE session_id = $2 RETURNING session_id AS id, entry_code AS code, TRIM(status) AS status",
      ["geschlossen", id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: "Raum nicht gefunden" });
    res.json({ room: r.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Fehler beim Schließen des Raums" });
  }
});

app.patch("/api/rooms/:id/start", async (req, res) => {
app.patch("/api/rooms/:id/start", async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query(
      "UPDATE session SET status = $1 WHERE session_id = $2 RETURNING session_id AS id, entry_code AS code, TRIM(status) AS status",
      ["gestartet", id]
    const r = await pool.query(
      "UPDATE session SET status = $1 WHERE session_id = $2 RETURNING session_id AS id, entry_code AS code, TRIM(status) AS status",
      ["gestartet", id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: "Raum nicht gefunden" });
    res.json({ room: r.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Fehler beim Starten der Rallye" });
    if (r.rows.length === 0) return res.status(404).json({ error: "Raum nicht gefunden" });
    res.json({ room: r.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Fehler beim Starten der Rallye" });
  }
});

// -------------------- Raum löschen + Verknüpfungen --------------------
app.delete("/api/rooms/:id", async (req, res) => {
  const client = await pool.connect();
// -------------------- Raum löschen + Verknüpfungen --------------------
app.delete("/api/rooms/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    await client.query("BEGIN");

    await client.query("DELETE FROM sessiongroups WHERE session_id = $1", [id]);

    const r = await client.query(
      "DELETE FROM session WHERE session_id = $1 RETURNING session_id AS id, entry_code AS code",
      [id]
    );

    if (r.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Raum nicht gefunden" });
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Raum und zugehörige Verknüpfungen gelöscht",
      deletedRoom: r.rows[0],
    });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("❌ Fehler beim Löschen des Raums:", e);
    res.status(500).json({ error: "Fehler beim Löschen des Raums" });
  } finally {
    client.release();
    await client.query("BEGIN");

    await client.query("DELETE FROM sessiongroups WHERE session_id = $1", [id]);

    const r = await client.query(
      "DELETE FROM session WHERE session_id = $1 RETURNING session_id AS id, entry_code AS code",
      [id]
    );

    if (r.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Raum nicht gefunden" });
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Raum und zugehörige Verknüpfungen gelöscht",
      deletedRoom: r.rows[0],
    });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("❌ Fehler beim Löschen des Raums:", e);
    res.status(500).json({ error: "Fehler beim Löschen des Raums" });
  } finally {
    client.release();
  }
});

// -------------------- Raum prüfen --------------------
app.get("/api/rooms/check/:code", async (req, res) => {
// -------------------- Raum prüfen --------------------
app.get("/api/rooms/check/:code", async (req, res) => {
  try {
    const { code } = req.params;
    const r = await pool.query(
      `SELECT session_id AS id, rallye_id, TRIM(status) AS status, entry_code AS code
       FROM session
       WHERE UPPER(entry_code) = UPPER($1)
       AND UPPER(TRIM(status)) IN ('OFFEN','OPEN','GESTARTET')
       LIMIT 1`,
      [code]
    );
    const r = await pool.query(
      `SELECT session_id AS id, rallye_id, TRIM(status) AS status, entry_code AS code
       FROM session
       WHERE UPPER(entry_code) = UPPER($1)
       AND UPPER(TRIM(status)) IN ('OFFEN','OPEN','GESTARTET')
       LIMIT 1`,
      [code]
    );

    if (r.rows.length > 0) {
      const room = r.rows[0];
      res.json({ exists: true, rallye_id: room.rallye_id, status: room.status, code: room.code, id: room.id });
    } else {
      res.json({ exists: false });
    }
  } catch (e) {
    console.error("❌ Fehler beim Prüfen des Raumcodes:", e);
    res.status(500).json({ error: "Fehler beim Prüfen des Raumcodes" });
    if (r.rows.length > 0) {
      const room = r.rows[0];
      res.json({ exists: true, rallye_id: room.rallye_id, status: room.status, code: room.code, id: room.id });
    } else {
      res.json({ exists: false });
    }
  } catch (e) {
    console.error("❌ Fehler beim Prüfen des Raumcodes:", e);
    res.status(500).json({ error: "Fehler beim Prüfen des Raumcodes" });
  }
});


// -------------------- Gruppen / SessionGroups --------------------

// Vergebene Gruppennamen für Raum abrufen
app.get("/api/rooms/:roomCode/taken-groups", async (req, res) => {
// -------------------- Gruppen / SessionGroups --------------------

// Vergebene Gruppennamen für Raum abrufen
app.get("/api/rooms/:roomCode/taken-groups", async (req, res) => {
  try {
    const { roomCode } = req.params;
    const s = await pool.query("SELECT session_id FROM session WHERE entry_code = $1", [roomCode]);
    if (s.rows.length === 0) return res.status(404).json({ error: "Raum nicht gefunden" });
    const sessionId = s.rows[0].session_id;

    const r = await pool.query(
      `SELECT g.group_name 
       FROM sessiongroups sg
       JOIN groups g ON g.group_id = sg.group_id
       WHERE sg.session_id = $1`,
      [sessionId]
    );
    res.json({ takenGroups: r.rows.map(row => row.group_name) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Fehler beim Laden der vergebenen Gruppen" });
    const s = await pool.query("SELECT session_id FROM session WHERE entry_code = $1", [roomCode]);
    if (s.rows.length === 0) return res.status(404).json({ error: "Raum nicht gefunden" });
    const sessionId = s.rows[0].session_id;

    const r = await pool.query(
      `SELECT g.group_name 
       FROM sessiongroups sg
       JOIN groups g ON g.group_id = sg.group_id
       WHERE sg.session_id = $1`,
      [sessionId]
    );
    res.json({ takenGroups: r.rows.map(row => row.group_name) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Fehler beim Laden der vergebenen Gruppen" });
  }
});

// Gruppe beitreten (oder erstellen)
app.post("/api/rooms/:roomCode/join-group", async (req, res) => {
  const client = await pool.connect();
// Gruppe beitreten (oder erstellen)
app.post("/api/rooms/:roomCode/join-group", async (req, res) => {
  const client = await pool.connect();
  try {
    const { roomCode } = req.params;
    const { groupName } = req.body;
    if (!groupName) return res.status(400).json({ error: "Gruppenname fehlt" });

    const s = await client.query("SELECT session_id FROM session WHERE entry_code = $1", [roomCode]);
    if (s.rows.length === 0) return res.status(404).json({ error: "Raum nicht gefunden" });
    const sessionId = s.rows[0].session_id;

    let g = await client.query("SELECT group_id FROM groups WHERE group_name = $1", [groupName]);
    let groupId;
    if (g.rows.length === 0) {
      const newG = await client.query(
        "INSERT INTO groups (group_name) VALUES ($1) RETURNING group_id",
        [groupName]
      );
      groupId = newG.rows[0].group_id;
    } else {
      groupId = g.rows[0].group_id;
    }

    const existing = await client.query(
      "SELECT * FROM sessiongroups WHERE session_id = $1 AND group_id = $2",
      [sessionId, groupId]
    );
    if (existing.rows.length > 0)
      return res.json({ success: true, message: "Gruppe war bereits in dieser Session aktiv" });

    const insert = await client.query(
      "INSERT INTO sessiongroups (session_id, group_id, points, finished) VALUES ($1,$2,0,false) RETURNING *",
      [sessionId, groupId]
    );

    res.json({ success: true, created: true, sessionGroup: insert.rows[0] });
  } catch (e) {
    console.error("Fehler in /join-group:", e);
    res.status(500).json({ error: "Fehler beim Beitreten zur Gruppe" });
  } finally {
    client.release();
    if (!groupName) return res.status(400).json({ error: "Gruppenname fehlt" });

    const s = await client.query("SELECT session_id FROM session WHERE entry_code = $1", [roomCode]);
    if (s.rows.length === 0) return res.status(404).json({ error: "Raum nicht gefunden" });
    const sessionId = s.rows[0].session_id;

    let g = await client.query("SELECT group_id FROM groups WHERE group_name = $1", [groupName]);
    let groupId;
    if (g.rows.length === 0) {
      const newG = await client.query(
        "INSERT INTO groups (group_name) VALUES ($1) RETURNING group_id",
        [groupName]
      );
      groupId = newG.rows[0].group_id;
    } else {
      groupId = g.rows[0].group_id;
    }

    const existing = await client.query(
      "SELECT * FROM sessiongroups WHERE session_id = $1 AND group_id = $2",
      [sessionId, groupId]
    );
    if (existing.rows.length > 0)
      return res.json({ success: true, message: "Gruppe war bereits in dieser Session aktiv" });

    const insert = await client.query(
      "INSERT INTO sessiongroups (session_id, group_id, points, finished) VALUES ($1,$2,0,false) RETURNING *",
      [sessionId, groupId]
    );

    res.json({ success: true, created: true, sessionGroup: insert.rows[0] });
  } catch (e) {
    console.error("Fehler in /join-group:", e);
    res.status(500).json({ error: "Fehler beim Beitreten zur Gruppe" });
  } finally {
    client.release();
  }
});

// Alle Gruppen (Stammdaten)
app.get("/api/group-names", async (_, res) => {
// Alle Gruppen (Stammdaten)
app.get("/api/group-names", async (_, res) => {
  try {
    const r = await pool.query("SELECT group_id, group_name FROM groups ORDER BY group_name ASC");
    res.json({ groupNames: r.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Fehler beim Laden der Gruppennamen" });
    const r = await pool.query("SELECT group_id, group_name FROM groups ORDER BY group_name ASC");
    res.json({ groupNames: r.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Fehler beim Laden der Gruppennamen" });
  }
});

// -------------------- Serverstart --------------------
// -------------------- Serverstart --------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server läuft auf Port ${PORT}`));
app.listen(PORT, () => console.log(`✅ Server läuft auf Port ${PORT}`));
