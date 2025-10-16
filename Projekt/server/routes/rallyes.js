const express = require('express');
const { pool, dbEnabled } = require('../lib/db');
const router = express.Router();

router.get('/', async (req, res) => {
  if (!dbEnabled) return res.json({ rallyes: [] });
  try {
    const result = await pool.query('SELECT rallye_id AS id, name, beschreibung FROM rallye ORDER BY name ASC');
    res.json({ rallyes: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden der Rallyes' });
  }
});

module.exports = router;
