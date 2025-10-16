const express = require('express');
const { pool, dbEnabled } = require('../../lib/db');
const router = express.Router();

// basic info
router.get('/info', (req, res) => res.json({ page: 'admin', ok: true }));

// GET /api/page/admin/rooms -> aggregated list using session table
router.get('/rooms', async (req, res) => {
	if (!dbEnabled) return res.json({ rooms: [] });
	try {
		const r = await pool.query('SELECT session_id AS id, entry_code AS code, TRIM(status) AS status, rallye_id FROM session ORDER BY session_id DESC');
		res.json({ rooms: r.rows });
	} catch (e) {
		console.error('admin/rooms error', e);
		res.status(500).json({ error: 'Fehler' });
	}
});

// close room by id
router.patch('/rooms/:id/close', async (req, res) => {
	if (!dbEnabled) return res.status(500).json({ error: 'DB not enabled' });
	try {
		const id = req.params.id;
		const r = await pool.query('UPDATE session SET status = $1 WHERE session_id = $2 RETURNING session_id, entry_code, TRIM(status) AS status, rallye_id', ['geschlossen', id]);
		if (r.rows.length === 0) return res.status(404).json({ error: 'Raum nicht gefunden' });
		res.json({ room: r.rows[0] });
	} catch (e) {
		console.error('admin close error', e);
		res.status(500).json({ error: 'Fehler' });
	}
});

// start room by id
router.patch('/rooms/:id/start', async (req, res) => {
	if (!dbEnabled) return res.status(500).json({ error: 'DB not enabled' });
	try {
		const id = req.params.id;
		const r = await pool.query('UPDATE session SET status = $1 WHERE session_id = $2 RETURNING *', ['gestartet', id]);
		if (r.rows.length === 0) return res.status(404).json({ error: 'Raum nicht gefunden' });
		res.json({ room: r.rows[0] });
	} catch (e) {
		console.error('admin start error', e);
		res.status(500).json({ error: 'Fehler' });
	}
});

// delete room
router.delete('/rooms/:id', async (req, res) => {
	if (!dbEnabled) return res.status(500).json({ error: 'DB not enabled' });
	try {
		const id = req.params.id;
		await pool.query('DELETE FROM sessiongroups WHERE session_id = $1', [id]);
		const r = await pool.query('DELETE FROM session WHERE session_id = $1 RETURNING session_id', [id]);
		if (r.rows.length === 0) return res.status(404).json({ error: 'Raum nicht gefunden' });
		res.json({ success: true });
	} catch (e) {
		console.error('admin delete error', e);
		res.status(500).json({ error: 'Fehler' });
	}
});

module.exports = router;
