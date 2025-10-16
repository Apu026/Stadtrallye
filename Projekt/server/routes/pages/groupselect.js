const express = require('express');
const { pool, dbEnabled } = require('../../lib/db');
const router = express.Router();

router.get('/info', (req, res) => res.json({ page: 'groupselect', ok: true }));

// GET taken-groups by roomCode (proxy to rooms/sessiongroups logic)
router.get('/taken-groups/:roomCode', async (req, res) => {
	const { roomCode } = req.params;
	if (!dbEnabled) return res.json({ takenGroups: [] });
	try {
		const sessionResult = await pool.query('SELECT session_id FROM session WHERE entry_code = $1', [roomCode]);
		if (sessionResult.rows.length === 0) return res.status(404).json({ error: 'Session nicht gefunden' });
		const sessionId = sessionResult.rows[0].session_id;
		const takenResult = await pool.query(`SELECT g.group_name FROM groups g JOIN sessiongroups sg ON g.group_id = sg.group_id WHERE sg.session_id = $1`, [sessionId]);
		const takenGroups = takenResult.rows.map(r => r.group_name);
		res.json({ takenGroups });
	} catch (e) {
		console.error('groupselect taken-groups error', e);
		res.status(500).json({ error: 'Fehler' });
	}
});

module.exports = router;
