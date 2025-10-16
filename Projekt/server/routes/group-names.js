const express = require('express');
const { pool, dbEnabled } = require('../lib/db');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    if (!dbEnabled) return res.json({ groupNames: [] });
    const result = await pool.query('SELECT group_id, group_name FROM groups ORDER BY group_name ASC');
    res.json({ groupNames: result.rows });
  } catch (e) {
    console.error('Error /api/group-names', e);
    res.status(500).json({ error: 'Fehler beim Laden der Gruppen' });
  }
});

module.exports = router;
