const express = require('express');
const { pool, dbEnabled } = require('../lib/db');
const router = express.Router();

router.get('/', async (req, res) => {
  const poiId = Number(req.query.poi_id);
  if (!poiId) return res.status(400).json({ error: 'poi_id ist erforderlich' });

  if (!dbEnabled) return res.json({ questions: [] });

  try {
    const q = `
      SELECT q_id AS id,
             question,
             answers,
             correct_answer_idx AS "correctAnswerIndex",
             poi_id
      FROM question
      WHERE poi_id = $1
      ORDER BY q_id
    `;
    const r = await pool.query(q, [poiId]);
    const questions = r.rows.map(row => ({
      ...row,
      answers: row.answers || []
    }));
    res.json({ questions });
  } catch (err) {
    console.error('Fehler beim Laden der Fragen:', err);
    res.status(500).json({ error: 'Fragen konnten nicht geladen werden' });
  }
});

module.exports = router;
