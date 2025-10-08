const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL-Verbindung
const pool = new Pool({
  user: process.env.PGUSER || 'postgres',
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'stadtrallye',
  password: process.env.PGPASSWORD || 'dein_db_passwort',
  port: process.env.PGPORT ? parseInt(process.env.PGPORT) : 5432,
});

// Alle Nutzer abrufen (Superadmin-API)
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role FROM users ORDER BY username ASC');
    res.json({ users: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden der Nutzer' });
  }
});

// Test-Route
app.get('/', (req, res) => {
  res.send('Backend läuft!');
});

// Login-Route
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'User not found' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Wrong password' });

    res.json({ success: true, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
