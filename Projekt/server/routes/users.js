const express = require('express');
const bcrypt = require('bcrypt');
const { pool } = require('../lib/db');
const router = express.Router();

// GET /api/users
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT user_id, name, role FROM users ORDER BY name ASC');
    res.json({ users: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden der Nutzer' });
  }
});

// POST /api/users
router.post('/', async (req, res) => {
  try {
    const { name, role, password } = req.body || {};
    if (!name || !role || !password) {
      return res.status(400).json({ error: 'name, role und password sind erforderlich' });
    }
    const exists = await pool.query('SELECT 1 FROM users WHERE name = $1', [name]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'Benutzername bereits vergeben' });
    }
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (name, role, password) VALUES ($1, $2, $3) RETURNING user_id, name, role',
      [name, role, hash]
    );
    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Anlegen des Nutzers' });
  }
});

// PATCH /api/users/:id
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, password } = req.body || {};
    const userRes = await pool.query('SELECT user_id, name, role FROM users WHERE user_id = $1', [id]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'Nutzer nicht gefunden' });

    if (name) {
      const nameRes = await pool.query('SELECT 1 FROM users WHERE name = $1 AND user_id <> $2', [name, id]);
      if (nameRes.rows.length > 0) return res.status(409).json({ error: 'Benutzername bereits vergeben' });
    }

    const fields = [];
    const values = [];
    let idx = 1;
    if (name) { fields.push(`name = $${idx++}`); values.push(name); }
    if (role) { fields.push(`role = $${idx++}`); values.push(role); }
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      fields.push(`password = $${idx++}`);
      values.push(hash);
    }
    if (fields.length === 0) {
      return res.status(400).json({ error: 'Keine änderbaren Felder übergeben' });
    }
    values.push(id);
    const query = `UPDATE users SET ${fields.join(', ')} WHERE user_id = $${idx} RETURNING user_id, name, role`;
    const updateRes = await pool.query(query, values);
    res.json({ user: updateRes.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Nutzers' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const del = await pool.query('DELETE FROM users WHERE user_id = $1 RETURNING user_id, name, role', [id]);
    if (del.rows.length === 0) return res.status(404).json({ error: 'Nutzer nicht gefunden' });
    res.json({ success: true, user: del.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Löschen des Nutzers' });
  }
});

module.exports = router;
