const express = require('express');
const { pool, dbEnabled } = require('../../lib/db');
const bcrypt = require('bcrypt');
const router = express.Router();

router.get('/info', (req, res) => res.json({ page: 'superadmin', ok: true }));

// list users
router.get('/users', async (req, res) => {
	if (!dbEnabled) return res.json({ users: [] });
	try {
		const r = await pool.query('SELECT user_id, name, role FROM users ORDER BY name ASC');
		res.json({ users: r.rows });
	} catch (e) {
		console.error('superadmin users error', e);
		res.status(500).json({ error: 'Fehler' });
	}
});

// create user
router.post('/users', async (req, res) => {
	if (!dbEnabled) return res.status(500).json({ error: 'DB not enabled' });
	try {
		const { name, role, password } = req.body || {};
		if (!name || !role || !password) return res.status(400).json({ error: 'name, role und password sind erforderlich' });
		const exists = await pool.query('SELECT 1 FROM users WHERE name = $1', [name]);
		if (exists.rows.length > 0) return res.status(409).json({ error: 'Benutzername bereits vergeben' });
		const hash = await bcrypt.hash(password, 12);
		const r = await pool.query('INSERT INTO users (name, role, password) VALUES ($1,$2,$3) RETURNING user_id, name, role', [name, role, hash]);
		res.status(201).json({ user: r.rows[0] });
	} catch (e) {
		console.error('superadmin create user error', e);
		res.status(500).json({ error: 'Fehler' });
	}
});

module.exports = router;
