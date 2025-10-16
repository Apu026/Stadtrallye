const express = require('express');
const { pool, dbEnabled } = require('../../lib/db');
const router = express.Router();

// Helper to map DB row to AdminSpielseite POI shape
function mapPoiRow(row) {
  return {
    id: row.id,
    name: row.name,
    lat: Number(row.lat),
    lng: Number(row.lng),
    radius_meters: row.radius_meters != null ? Number(row.radius_meters) : (row.radius != null ? Number(row.radius) : 50),
    description: row.description || null,
  };
}

// quick diagnostics
router.get('/health', (req, res) => {
  return res.json({ ok: true, dbEnabled });
});

// GET /api/page/adminspielseite/pois
router.get('/pois', async (req, res) => {
  if (!dbEnabled) return res.json([]);
  try {
    const q = `
      SELECT poi_id AS id,
             poi_name AS name,
             coords_lat AS lat,
             coords_lng AS lng,
             radius_meters,
             description
      FROM pois
      ORDER BY poi_id`;
    const r = await pool.query(q);
    return res.json(r.rows.map(mapPoiRow));
  } catch (e) {
    console.error('adminspielseite GET /pois failed:', e.message || e);
    // Safe fallback for UI
    return res.json([]);
  }
});

// POST /api/page/adminspielseite/pois
router.post('/pois', async (req, res) => {
  if (!dbEnabled) return res.status(501).json({ error: 'DB_DISABLED' });
  const { name, lat, lng, radius_meters = 50, description = null } = req.body || {};
  if (!name || lat == null || lng == null) return res.status(400).json({ error: 'INVALID_INPUT' });
  try {
    const q = `
      INSERT INTO pois (poi_name, coords_lat, coords_lng, radius_meters, description)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING poi_id AS id, poi_name AS name, coords_lat AS lat, coords_lng AS lng, radius_meters, description`;
    const r = await pool.query(q, [name, Number(lat), Number(lng), Number(radius_meters), description]);
    return res.status(201).json(mapPoiRow(r.rows[0]));
  } catch (e) {
    console.error('adminspielseite POST /pois failed:', e.message || e);
    return res.status(500).json({ error: 'DB_ERROR' });
  }
});

// PUT /api/page/adminspielseite/pois/:id
router.put('/pois/:id', async (req, res) => {
  if (!dbEnabled) return res.status(501).json({ error: 'DB_DISABLED' });
  const { id } = req.params;
  const { name, lat, lng, radius_meters = 50, description = null } = req.body || {};
  if (!name || lat == null || lng == null) return res.status(400).json({ error: 'INVALID_INPUT' });
  try {
    const q = `
      UPDATE pois
      SET poi_name = $1, coords_lat = $2, coords_lng = $3, radius_meters = $4, description = $5
      WHERE poi_id = $6
      RETURNING poi_id AS id, poi_name AS name, coords_lat AS lat, coords_lng AS lng, radius_meters, description`;
    const r = await pool.query(q, [name, Number(lat), Number(lng), Number(radius_meters), description, Number(id)]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json(mapPoiRow(r.rows[0]));
  } catch (e) {
    console.error('adminspielseite PUT /pois/:id failed:', e.message || e);
    return res.status(500).json({ error: 'DB_ERROR' });
  }
});

// DELETE /api/page/adminspielseite/pois/:id
router.delete('/pois/:id', async (req, res) => {
  if (!dbEnabled) return res.status(501).json({ error: 'DB_DISABLED' });
  const { id } = req.params;
  try {
    const r = await pool.query('DELETE FROM pois WHERE poi_id = $1', [Number(id)]);
    // 204 even if nothing deleted to keep client simple
    return res.status(204).send();
  } catch (e) {
    console.error('adminspielseite DELETE /pois/:id failed:', e.message || e);
    return res.status(500).json({ error: 'DB_ERROR' });
  }
});

// QUESTIONS ENDPOINTS
// NOTE: Assumes a table `questions` (question_id, poi_id, question_text, answers (jsonb/text[]), correct_answer_idx)

// GET /api/page/adminspielseite/pois/:id/questions
router.get('/pois/:id/questions', async (req, res) => {
  if (!dbEnabled) return res.json([]);
  const { id } = req.params;
  try {
    const q = `
      SELECT question_id AS id,
             poi_id,
             question_text AS question,
             answers,
             correct_answer_idx
      FROM questions
      WHERE poi_id = $1
      ORDER BY question_id`;
    const r = await pool.query(q, [Number(id)]);
    // Normalize answers to array
    const rows = r.rows.map(row => ({
      id: row.id,
      question: row.question,
      answers: Array.isArray(row.answers) ? row.answers : (typeof row.answers === 'string' ? JSON.parse(row.answers || '[]') : []),
      correct_answer_idx: Number(row.correct_answer_idx) || 0,
    }));
    return res.json(rows);
  } catch (e) {
    console.error('adminspielseite GET /pois/:id/questions failed:', e.message || e);
    // Safe fallback for UI
    return res.json([]);
  }
});

// POST /api/page/adminspielseite/pois/:id/questions
router.post('/pois/:id/questions', async (req, res) => {
  if (!dbEnabled) return res.status(501).json({ error: 'DB_DISABLED' });
  const { id } = req.params;
  const { question, answers = [], correct_answer_idx = 0 } = req.body || {};
  if (!question) return res.status(400).json({ error: 'INVALID_INPUT' });
  try {
    const q = `
      INSERT INTO questions (poi_id, question_text, answers, correct_answer_idx)
      VALUES ($1, $2, $3, $4)
      RETURNING question_id AS id, question_text AS question, answers, correct_answer_idx`;
    const r = await pool.query(q, [Number(id), question, JSON.stringify(answers), Number(correct_answer_idx)]);
    const row = r.rows[0];
    return res.status(201).json({
      id: row.id,
      question: row.question,
      answers: Array.isArray(row.answers) ? row.answers : (typeof row.answers === 'string' ? JSON.parse(row.answers || '[]') : []),
      correct_answer_idx: Number(row.correct_answer_idx) || 0,
    });
  } catch (e) {
    console.error('adminspielseite POST /pois/:id/questions failed:', e.message || e);
    return res.status(500).json({ error: 'DB_ERROR' });
  }
});

// PUT /api/page/adminspielseite/questions/:id
router.put('/questions/:id', async (req, res) => {
  if (!dbEnabled) return res.status(501).json({ error: 'DB_DISABLED' });
  const { id } = req.params;
  const { question, answers = [], correct_answer_idx = 0 } = req.body || {};
  if (!question) return res.status(400).json({ error: 'INVALID_INPUT' });
  try {
    const q = `
      UPDATE questions
      SET question_text = $1,
          answers = $2,
          correct_answer_idx = $3
      WHERE question_id = $4
      RETURNING question_id AS id, question_text AS question, answers, correct_answer_idx`;
    const r = await pool.query(q, [question, JSON.stringify(answers), Number(correct_answer_idx), Number(id)]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    const row = r.rows[0];
    return res.json({
      id: row.id,
      question: row.question,
      answers: Array.isArray(row.answers) ? row.answers : (typeof row.answers === 'string' ? JSON.parse(row.answers || '[]') : []),
      correct_answer_idx: Number(row.correct_answer_idx) || 0,
    });
  } catch (e) {
    console.error('adminspielseite PUT /questions/:id failed:', e.message || e);
    return res.status(500).json({ error: 'DB_ERROR' });
  }
});

// DELETE /api/page/adminspielseite/questions/:id
router.delete('/questions/:id', async (req, res) => {
  if (!dbEnabled) return res.status(501).json({ error: 'DB_DISABLED' });
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM questions WHERE question_id = $1', [Number(id)]);
    return res.status(204).send();
  } catch (e) {
    console.error('adminspielseite DELETE /questions/:id failed:', e.message || e);
    return res.status(500).json({ error: 'DB_ERROR' });
  }
});

// Below are additional monitoring endpoints for Admin live view
// GET /api/page/adminspielseite/players?roomCode=ABC123
router.get('/players', async (req, res) => {
  if (!dbEnabled) return res.json({ players: [] });
  const { roomCode } = req.query;
  if (!roomCode) return res.json({ players: [] });
  try {
    const sr = await pool.query('SELECT session_id FROM session WHERE entry_code = $1', [roomCode]);
    if (sr.rows.length === 0) return res.json({ players: [] });
    const sessionId = sr.rows[0].session_id;
    const q = `
      SELECT sg.group_id, g.group_name
      FROM sessiongroups sg
      JOIN groups g ON g.group_id = sg.group_id
      WHERE sg.session_id = $1
      ORDER BY g.group_name ASC`;
    const r = await pool.query(q, [sessionId]);
    return res.json({ players: r.rows.map(row => ({ id: row.group_id, name: row.group_name })) });
  } catch (e) {
    console.error('adminspielseite GET /players failed:', e.message || e);
    return res.json({ players: [] });
  }
});

// GET /api/page/adminspielseite/players/:groupId/route?roomCode=ABC123
// Assumes a table positions(session_id, group_id, lat, lng, ts)
router.get('/players/:groupId/route', async (req, res) => {
  if (!dbEnabled) return res.json({ route: [] });
  const { groupId } = req.params;
  const { roomCode } = req.query;
  if (!groupId || !roomCode) return res.json({ route: [] });
  try {
    const sr = await pool.query('SELECT session_id FROM session WHERE entry_code = $1', [roomCode]);
    if (sr.rows.length === 0) return res.json({ route: [] });
    const sessionId = sr.rows[0].session_id;
    try {
      const r = await pool.query(
        'SELECT lat, lng, ts FROM positions WHERE session_id = $1 AND group_id = $2 ORDER BY ts ASC',
        [sessionId, Number(groupId)]
      );
      return res.json({ route: r.rows.map(row => ({ lat: Number(row.lat), lng: Number(row.lng), ts: row.ts })) });
    } catch (inner) {
      // positions table may not exist yet; return safe fallback
      console.warn('positions lookup failed, returning empty route:', inner.message || inner);
      return res.json({ route: [] });
    }
  } catch (e) {
    console.error('adminspielseite GET /players/:groupId/route failed:', e.message || e);
    return res.json({ route: [] });
  }
});

module.exports = router;
