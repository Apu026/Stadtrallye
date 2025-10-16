const express = require('express');
const { pool, dbEnabled } = require('../lib/db');
const router = express.Router();

function generateRoomCode(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// POST /api/rooms
router.post('/', async (req, res) => {
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

// GET /api/rooms (open sessions)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM session WHERE status = $1', ['offen']);
    res.json({ rooms: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden der Sessions' });
  }
});

// GET /api/rooms/all
router.get('/all', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM session');
    res.json({ rooms: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden aller Sessions' });
  }
});

// PATCH /api/rooms/:id/close
router.patch('/:id/close', async (req, res) => {
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

// DELETE /api/rooms/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM sessiongroups WHERE session_id = $1', [id]);
    const result = await pool.query('DELETE FROM session WHERE session_id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Session nicht gefunden' });
    res.json({ success: true, deletedRoom: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Löschen der Session' });
  }
});

// GET /api/group-names
router.get('/group-names', async (req, res) => {
  try {
    const result = await pool.query('SELECT group_id, group_name FROM groups ORDER BY group_name ASC');
    res.json({ groupNames: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden der Gruppen' });
  }
});

// GET /api/rooms/check/:code
router.get('/check/:code', async (req, res) => {
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

// GET /api/rooms/code/:code
router.get('/code/:code', async (req, res) => {
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

// POST /api/rooms/:roomCode/finish -> mark session closed by entry_code
router.post('/:roomCode/finish', async (req, res) => {
  try {
    const { roomCode } = req.params;
    // find session by code
    const sr = await pool.query('SELECT session_id FROM session WHERE entry_code = $1', [roomCode]);
    if (sr.rows.length === 0) return res.status(404).json({ error: 'Session nicht gefunden' });
    const sessionId = sr.rows[0].session_id;
    const r = await pool.query('UPDATE session SET status = $1 WHERE session_id = $2 RETURNING session_id, entry_code, TRIM(status) AS status, rallye_id', ['geschlossen', sessionId]);
    res.json({ room: { id: r.rows[0].session_id, code: r.rows[0].entry_code, status: r.rows[0].status, rallye_id: r.rows[0].rallye_id } });
  } catch (e) {
    console.error('Error finishing room:', e);
    res.status(500).json({ error: 'Fehler beim Beenden des Raums' });
  }
});

// GET /api/rooms/:roomCode/taken-groups
router.get('/:roomCode/taken-groups', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const sessionResult = await pool.query('SELECT session_id FROM session WHERE entry_code = $1', [roomCode]);
    if (sessionResult.rows.length === 0) return res.status(404).json({ error: 'Session nicht gefunden' });
    const sessionId = sessionResult.rows[0].session_id;
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

// POST /api/rooms/:roomCode/join-group
router.post('/:roomCode/join-group', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { groupName } = req.body;
    if (!groupName) return res.status(400).json({ error: 'Gruppenname fehlt' });
    const sessionResult = await pool.query('SELECT session_id FROM session WHERE entry_code = $1', [roomCode]);
    if (sessionResult.rows.length === 0) return res.status(404).json({ error: 'Session nicht gefunden' });
    const sessionId = sessionResult.rows[0].session_id;
    const groupResult = await pool.query('SELECT group_id FROM groups WHERE group_name = $1', [groupName]);
    if (groupResult.rows.length === 0) return res.status(404).json({ error: 'Gruppe nicht gefunden' });
    const groupId = groupResult.rows[0].group_id;
    const taken = await pool.query('SELECT 1 FROM sessiongroups WHERE session_id = $1 AND group_id = $2', [sessionId, groupId]);
    if (taken.rows.length > 0) return res.status(409).json({ error: 'Gruppenname bereits vergeben' });
    await pool.query('INSERT INTO sessiongroups (session_id, group_id) VALUES ($1, $2)', [sessionId, groupId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Beitreten zur Gruppe' });
  }
});

// PATCH /api/rooms/:id/start
router.patch('/:id/start', async (req, res) => {
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

// GET /api/rooms/:code/rallye-id
router.get('/:code/rallye-id', async (req, res) => {
  try {
    const { code } = req.params;
    const result = await pool.query('SELECT rallye_id FROM session WHERE entry_code = $1', [code]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Session nicht gefunden' });
    res.json({ rallye_id: result.rows[0].rallye_id });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Abrufen der Rallye-ID' });
  }
});

// PATCH /api/rooms/:id/close (duplicate-safe)
router.patch('/:id/close-duplicate', async (req, res) => {
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

// DELETE /api/rooms/:id (duplicate-safe)
router.delete('/:id/delete-duplicate', async (req, res) => {
  if (!dbEnabled) return res.status(500).json({ error: 'DB not enabled' });
  try {
    const id = req.params.id;
    await pool.query('DELETE FROM sessiongroups WHERE session_id = $1', [id]);
    const r = await pool.query('DELETE FROM session WHERE session_id = $1 RETURNING session_id', [id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Raum nicht gefunden' });
    res.json({ success: true });
  } catch (e) {
    console.error('Error deleting room:', e);
    res.status(500).json({ error: 'Fehler beim Löschen des Raums' });
  }
});

module.exports = router;
