const express = require('express');
const { pool, dbEnabled } = require('../lib/db');
const router = express.Router();

// GET /api/sessiongroups?roomCode=XXX
router.get('/', async (req, res) => {
  const { roomCode } = req.query;
  // always return an object with sessiongroups array for consistency
  if (!dbEnabled) return res.json({ sessiongroups: [] });
  try {
    if (roomCode) {
      const sr = await pool.query('SELECT session_id FROM session WHERE entry_code = $1', [roomCode]);
      if (sr.rows.length === 0) return res.json({ sessiongroups: [] });
      const sessionId = sr.rows[0].session_id;
      const sgr = await pool.query('SELECT session_id, group_id, points, lat, long FROM sessiongroups WHERE session_id = $1', [sessionId]);
      return res.json({ sessiongroups: sgr.rows });
    }
    const r = await pool.query('SELECT session_id, group_id, points, lat, long FROM sessiongroups');
    res.json({ sessiongroups: r.rows });
  } catch (e) {
    // Log error details for debugging, but return a safe empty response to the frontend
    console.error('Error in /api/sessiongroups:', e && e.message ? e.message : e);
    if (e && e.stack) console.error(e.stack);
    res.json({ sessiongroups: [] });
  }
});

// POST /api/sessiongroups/location
// Body: { roomCode, groupName, lat, long }
router.post('/location', async (req, res) => {
  try {
    let { roomCode, groupName, lat, long, groupId, sessionId } = req.body || {};
    // Debug log
    console.log('[location] incoming', { roomCode, groupName, lat, long, groupId, sessionId });
    if (typeof lat === 'string') lat = Number(lat);
    if (typeof long === 'string') long = Number(long);
    if (!roomCode && !sessionId) {
      return res.status(400).json({ error: 'roomCode or sessionId required' });
    }
    if (!groupName && !groupId) {
      return res.status(400).json({ error: 'groupName or groupId required' });
    }
    if (typeof lat !== 'number' || isNaN(lat) || typeof long !== 'number' || isNaN(long)) {
      return res.status(400).json({ error: 'lat and long must be numbers' });
    }

    if (!dbEnabled) {
      // No DB: accept silently so frontend can continue
      return res.json({ ok: true, db: false });
    }

    // Find session_id for roomCode
    if (!sessionId) {
      const sRes = await pool.query('SELECT session_id FROM session WHERE UPPER(entry_code) = UPPER($1) LIMIT 1', [roomCode.trim()]);
      if (sRes.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
      sessionId = sRes.rows[0].session_id;
    }

    // Find group_id for groupName
    if (!groupId) {
      const gRes = await pool.query('SELECT group_id FROM groups WHERE LOWER(group_name) = LOWER($1) LIMIT 1', [groupName.trim()]);
      if (gRes.rows.length === 0) return res.status(404).json({ error: 'Group not found' });
      groupId = gRes.rows[0].group_id;
    }

    // Update coordinates in sessiongroups
    const uRes = await pool.query(
      'UPDATE sessiongroups SET lat = $3, long = $4 WHERE session_id = $1 AND group_id = $2 RETURNING session_id, group_id',
      [sessionId, groupId, lat, long]
    );
    console.log('[location] matched', { sessionId, groupId, updated: uRes.rowCount });
    if (uRes.rowCount === 0) {
      // If no row exists yet, create one with 0 points and set coords
      await pool.query(
        'INSERT INTO sessiongroups (session_id, group_id, points, lat, long) VALUES ($1, $2, 0, $3, $4)',
        [sessionId, groupId, lat, long]
      );
      console.log('[location] inserted new sessiongroup row');
    }

    return res.json({ ok: true, session_id: sessionId, group_id: groupId });
  } catch (e) {
    console.error('Error in POST /api/sessiongroups/location:', e && e.message ? e.message : e);
    if (e && e.stack) console.error(e.stack);
    return res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;
