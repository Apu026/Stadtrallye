const express = require('express');
const { pool, dbEnabled } = require('../../lib/db');
const router = express.Router();

router.get('/info', (req, res) => res.json({ page: 'waitingroom', ok: true }));

// GET /api/page/waitingroom/session/:code -> get session by code
router.get('/session/:code', async (req, res) => {
	if (!dbEnabled) return res.status(404).json({ error: 'DB not enabled' });
	try {
		const { code } = req.params;
		const r = await pool.query('SELECT * FROM session WHERE entry_code = $1', [code]);
		if (r.rows.length === 0) return res.status(404).json({ error: 'Session nicht gefunden' });
		res.json({ room: r.rows[0] });
	} catch (e) {
		console.error('waitingroom session error', e);
		res.status(500).json({ error: 'Fehler' });
	}
});

module.exports = router;
