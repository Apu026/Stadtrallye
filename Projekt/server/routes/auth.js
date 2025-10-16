const express = require('express');
const { pool, dbEnabled } = require('../lib/db');
const bcrypt = require('bcrypt');
const router = express.Router();

// POST /api/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  try {
    if (!dbEnabled) {
      // Dev-safe: accept any credentials and return role 'dev'
      return res.json({ success: true, role: 'dev' });
    }
    const result = await pool.query('SELECT * FROM users WHERE name = $1', [username]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'User not found' });
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Wrong password' });
    res.json({ success: true, role: user.role });
  } catch (e) {
    console.error('Error in /api/login', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
