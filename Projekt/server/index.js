// Express-Server mit PostgreSQL für Stadtrallye
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// .env-Datei laden (DB-Zugangsdaten)
dotenv.config();

// Express-App initialisieren
const app = express();
app.use(cors());
app.use(express.json());

// Verbindung zur PostgreSQL-Datenbank herstellen
const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT ? parseInt(process.env.PGPORT) : 5432,
});

// -------------------- Hilfsfunktionen --------------------

// Zufälligen Raum-Code generieren
function generateRoomCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// -------------------- Nutzerverwaltung --------------------

// Alle Nutzer auslesen
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT user_id AS id, name AS username, role FROM users ORDER BY name ASC'
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden der Nutzer' });
  }
});

// Login
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

// -------------------- Rallyes --------------------

app.get('/api/rallyes', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT rallye_id AS id, name FROM rallye ORDER BY name ASC'
    );
    res.json({ rallyes: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden der Rallyes' });
  }
});

// -------------------- Räume / Sessions --------------------

// Alle offenen Räume
app.get('/api/rooms', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT session_id AS id, rallye_id, entry_code AS code, status FROM session WHERE status = $1 ORDER BY session_id DESC',
      ['offen']
    );
    res.json({ rooms: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden der Räume' });
  }
});

// Alle Räume (offen + geschlossen)
app.get('/api/rooms/all', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT session_id AS id, rallye_id, entry_code AS code, status FROM session ORDER BY session_id DESC'
    );
    res.json({ rooms: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden aller Räume' });
  }
});

// Raum erstellen
app.post('/api/rooms', async (req, res) => {
  try {
    const { rallye_id } = req.body;
    if (!rallye_id) return res.status(400).json({ error: 'rallye_id ist erforderlich' });

    let code, exists = true;
    while (exists) {
      code = generateRoomCode();
      const check = await pool.query('SELECT 1 FROM session WHERE entry_code = $1', [code]);
      exists = check.rows.length > 0;
    }

    const result = await pool.query(
      'INSERT INTO session (entry_code, status, rallye_id) VALUES ($1, $2, $3) RETURNING session_id AS id, entry_code AS code, status, rallye_id',
      [code, 'offen', rallye_id]
    );

    res.json({ room: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Erstellen des Raums' });
  }
});

// Raum schließen
app.patch('/api/rooms/:id/close', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE session SET status = $1 WHERE session_id = $2 RETURNING session_id AS id, entry_code AS code, status',
      ['geschlossen', id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Raum nicht gefunden' });
    res.json({ room: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Schließen des Raums' });
  }
});

// Raum löschen (Session + Verknüpfung zu Gruppen zurücksetzen)
app.delete('/api/rooms/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    await client.query('BEGIN');

    // Verknüpfung der Gruppen mit diesem Raum aufheben
    await client.query('UPDATE groups SET session_id = NULL, points = 0, finished = false WHERE session_id = $1', [id]);

    // Danach den Raum löschen
    const result = await client.query(
      'DELETE FROM session WHERE session_id = $1 RETURNING session_id AS id, entry_code AS code',
      [id]
    );

    await client.query('COMMIT');

    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Raum nicht gefunden' });

    res.json({
      success: true,
      message: `Raum ${result.rows[0].id} gelöscht, Gruppen wurden zurückgesetzt.`,
      deletedRoom: result.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Fehler beim Löschen des Raums:', err);
    res.status(500).json({ error: 'Fehler beim Löschen des Raums' });
  } finally {
    client.release();
  }
});



// Raum prüfen per Code
app.get('/api/rooms/check/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const result = await pool.query(
      `SELECT session_id AS id, rallye_id, status, entry_code AS code
       FROM session
       WHERE UPPER(entry_code) = UPPER($1)
       AND status IN ('offen','open','gestartet')
       LIMIT 1`,
      [code]
    );

    if (result.rows.length > 0) {
      const room = result.rows[0];
      return res.json({
        exists: true,
        rallye_id: room.rallye_id ?? null,
        status: room.status,
        code: room.code,
        id: room.id
      });
    }
    res.json({ exists: false });
  } catch (err) {
    console.error('Fehler in /api/rooms/check/:code:', err);
    res.status(500).json({ error: 'Fehler beim Prüfen des Raum-Codes' });
  }
});

// Raum starten
app.patch('/api/rooms/:id/start', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE session SET status = $1 WHERE session_id = $2 RETURNING session_id AS id, entry_code AS code, status',
      ['gestartet', id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Raum nicht gefunden' });
    res.json({ room: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Starten der Rallye' });
  }
});

// -------------------- Gruppen --------------------

// Vergebene Gruppennamen für Raum abrufen
app.get('/api/rooms/:roomCode/taken-groups', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const roomResult = await pool.query(
      'SELECT session_id AS id FROM session WHERE entry_code = $1',
      [roomCode]
    );
    if (roomResult.rows.length === 0) return res.status(404).json({ error: 'Raum nicht gefunden' });

    const roomId = roomResult.rows[0].id;

    // Hole Gruppen für diese Session
    const takenResult = await pool.query(
      'SELECT group_name FROM groups WHERE session_id = $1',
      [roomId]
    );
    const takenGroups = takenResult.rows.map(r => r.group_name);

    res.json({ takenGroups });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden der vergebenen Gruppennamen' });
  }
});

// Spieler tritt einer Gruppe bei – existierende Gruppe wird geupdated, neue werden erstellt
app.post('/api/rooms/:roomCode/join-group', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { groupName } = req.body;

    if (!groupName) {
      return res.status(400).json({ error: 'Gruppenname fehlt' });
    }

    // Raum-ID anhand Code finden
    const roomResult = await pool.query(
      'SELECT session_id AS id FROM session WHERE entry_code = $1',
      [roomCode]
    );

    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Raum nicht gefunden' });
    }

    const roomId = roomResult.rows[0].id;

    // Prüfen, ob Gruppe bereits existiert (egal ob sie schon einer Session zugeordnet ist)
    const groupResult = await pool.query(
      'SELECT group_id, session_id FROM groups WHERE group_name = $1 LIMIT 1',
      [groupName]
    );

    if (groupResult.rows.length > 0) {
      // Gruppe existiert → Update session_id (zu diesem Raum)
      const update = await pool.query(
        'UPDATE groups SET session_id = $1, points = COALESCE(points, 0), finished = false WHERE group_id = $2 RETURNING *',
        [roomId, groupResult.rows[0].group_id]
      );
      return res.json({ success: true, updated: true, group: update.rows[0] });
    } else {
      // Gruppe existiert noch nicht → Neue Gruppe anlegen
      const insert = await pool.query(
        'INSERT INTO groups (session_id, group_name, points, finished) VALUES ($1, $2, 0, false) RETURNING *',
        [roomId, groupName]
      );
      return res.json({ success: true, created: true, group: insert.rows[0] });
    }
  } catch (err) {
    console.error('Fehler in /join-group:', err);
    res.status(500).json({ error: 'Fehler beim Beitreten zur Gruppe' });
  }
});


// Optional: Alle Gruppennamen (für Übersicht / Fallback)
app.get('/api/group-names', async (req, res) => {
  try {
    const result = await pool.query('SELECT group_id, group_name FROM groups ORDER BY group_name ASC');
    res.json({ groupNames: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden der Gruppennamen' });
  }
});



// -------------------- Server starten --------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));
