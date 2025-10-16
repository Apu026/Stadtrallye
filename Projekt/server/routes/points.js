const express = require('express');
const { pool, dbEnabled } = require('../lib/db');
const router = express.Router();

// POST /api/points -> Punkte hinzufügen
router.post('/', async (req, res) => {
  if (!dbEnabled) return res.status(500).json({ error: 'DB not enabled' });

  try {
    const { roomCode, groupName, points } = req.body;
    if (!roomCode || !groupName) return res.status(400).json({ error: 'roomCode und groupName erforderlich' });

    // Session-ID ermitteln
    const sessionRes = await pool.query('SELECT session_id FROM session WHERE entry_code = $1', [roomCode]);
    if (sessionRes.rows.length === 0) return res.status(404).json({ error: 'Session nicht gefunden' });
    const sessionId = sessionRes.rows[0].session_id;

    // Gruppen-ID ermitteln
    const groupRes = await pool.query('SELECT group_id FROM groups WHERE group_name = $1', [groupName]);
    if (groupRes.rows.length === 0) return res.status(404).json({ error: 'Gruppe nicht gefunden' });
    const groupId = groupRes.rows[0].group_id;

    // Prüfen, ob schon ein Eintrag existiert
    const sgRes = await pool.query('SELECT points FROM sessiongroups WHERE session_id = $1 AND group_id = $2', [sessionId, groupId]);

    if (sgRes.rows.length === 0) {
      // Neu anlegen
      const insertRes = await pool.query(
        'INSERT INTO sessiongroups (session_id, group_id, points) VALUES ($1, $2, $3) RETURNING points',
        [sessionId, groupId, points || 100]
      );
      return res.json({ success: true, newPoints: insertRes.rows[0].points });
    } else {
      // Punkte addieren
      const newPoints = sgRes.rows[0].points + (points || 100);
      await pool.query('UPDATE sessiongroups SET points = $1 WHERE session_id = $2 AND group_id = $3', [newPoints, sessionId, groupId]);
      return res.json({ success: true, newPoints });
    }
  } catch (err) {
    console.error('Error in /api/points:', err);
    res.status(500).json({ error: 'Fehler beim Hinzufügen von Punkten' });
  }
});

module.exports = router;
