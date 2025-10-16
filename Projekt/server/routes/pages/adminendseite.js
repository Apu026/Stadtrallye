const express = require('express');
const { pool, dbEnabled } = require('../../lib/db');
const router = express.Router();

// In-memory ceremony state as fallback if no DB flag exists
const ceremonyMap = new Map(); // key: session_id, value: true/false

async function getSessionIdByCode(roomCode) {
  if (!dbEnabled) return null;
  try {
    const r = await pool.query('SELECT session_id FROM session WHERE entry_code = $1', [roomCode]);
    return r.rows[0]?.session_id ?? null;
  } catch (e) {
    return null;
  }
}

// GET /api/page/adminendseite/ceremony-status?roomCode=ABC123
router.get('/ceremony-status', async (req, res) => {
  const { roomCode } = req.query;
  if (!roomCode) return res.json({ ceremony: false });
  const sessionId = await getSessionIdByCode(roomCode);
  if (!sessionId) return res.json({ ceremony: !!ceremonyMap.get(roomCode) }); // fallback by code
  return res.json({ ceremony: !!ceremonyMap.get(sessionId) });
});

// POST /api/page/adminendseite/ceremony-start?roomCode=ABC123
router.post('/ceremony-start', async (req, res) => {
  const { roomCode } = req.query;
  if (!roomCode) return res.status(400).json({ error: 'ROOM_CODE_REQUIRED' });
  const sessionId = await getSessionIdByCode(roomCode);
  if (sessionId) ceremonyMap.set(sessionId, true); else ceremonyMap.set(roomCode, true);
  return res.json({ ok: true });
});

module.exports = router;