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
      const sgr = await pool.query('SELECT session_id, group_id, points FROM sessiongroups WHERE session_id = $1', [sessionId]);
      return res.json({ sessiongroups: sgr.rows });
    }
    const r = await pool.query('SELECT session_id, group_id, points FROM sessiongroups');
    res.json({ sessiongroups: r.rows });
  } catch (e) {
    // Log error details for debugging, but return a safe empty response to the frontend
    console.error('Error in /api/sessiongroups:', e && e.message ? e.message : e);
    if (e && e.stack) console.error(e.stack);
    res.json({ sessiongroups: [] });
  }
});

module.exports = router;
