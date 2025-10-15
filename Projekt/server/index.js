// ===============================
// Express-Server für Stadtrallye
// ===============================

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pkg from "pg";
import bcrypt from "bcrypt";

dotenv.config();
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

// -------------------- Datenbank --------------------
const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT ? parseInt(process.env.PGPORT) : 5432,
});

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
  }
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const r = await pool.query("SELECT * FROM users WHERE name = $1", [username]);
    if (r.rows.length === 0) return res.status(401).json({ error: "User not found" });
    const user = r.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Wrong password" });
    res.json({ success: true, role: user.role });
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
  try {
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
  try {
    const { rallye_id } = req.body;
    if (!rallye_id) return res.status(400).json({ error: "rallye_id ist erforderlich" });

    let code, exists = true;
    while (exists) {
      code = generateRoomCode();
      const check = await pool.query("SELECT 1 FROM session WHERE entry_code = $1", [code]);
      exists = check.rows.length > 0;
    }

    const r = await pool.query(
      "INSERT INTO session (entry_code, status, rallye_id) VALUES ($1,$2,$3) RETURNING session_id AS id, entry_code AS code, TRIM(status) AS status, rallye_id",
      [code, "offen", rallye_id]
    );
    res.json({ room: r.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Fehler beim Erstellen des Raums" });
  }
});

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
  }
});

app.patch("/api/rooms/:id/start", async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query(
      "UPDATE session SET status = $1 WHERE session_id = $2 RETURNING session_id AS id, entry_code AS code, TRIM(status) AS status",
      ["gestartet", id]
    );
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
  }
});

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
  }
});

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
  }
});

// Alle Gruppen (Stammdaten)
app.get("/api/group-names", async (_, res) => {
  try {
    const r = await pool.query("SELECT group_id, group_name FROM groups ORDER BY group_name ASC");
    res.json({ groupNames: r.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Fehler beim Laden der Gruppennamen" });
  }
});

// -------------------- Serverstart --------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server läuft auf Port ${PORT}`));
