// Express-Server und benötigte Pakete importieren
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
// .env-Datei laden (DB-Login)
dotenv.config();


// Express-App initialisieren
const app = express();
app.use(cors()); // CORS für API erlauben
app.use(express.json()); // JSON-Body-Parsing


// Verbindung zur PostgreSQL-Datenbank herstellen
const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT ? parseInt(process.env.PGPORT) : 5432, //Fallback auf 5432 wenn PGPORT nicht gesetzt ist
});

// Gibt alle Nutzer zurück (Nutzerverwaltung)
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role FROM users ORDER BY username ASC');
    res.json({ users: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden der Nutzer' });
  }
});


// Login-Route für Nutzer
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


// Hilfsfunktion: Erstellt einen zufälligen Raum-Code (Für Spieler)
function generateRoomCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}


// Räume-Tabelle anlegen, falls sie noch nicht existiert (später wieder entfernen)
pool.query(`
  CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    code VARCHAR(12) UNIQUE NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'offen',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP,
    admin_id INTEGER,
    rallye_id INTEGER
  )
`).catch(err => console.error('Fehler beim Anlegen der Tabelle rooms:', err));

// Gibt alle Rallyes zurück (für das Frontend)
app.get('/api/rallyes', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name FROM rallyes ORDER BY name ASC');
    res.json({ rallyes: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden der Rallyes' });
  }
});

// Erstellt einen neuen Raum
app.post('/api/rooms', async (req, res) => {
  try {
    let code;
    let exists = true;
    while (exists) {
      code = generateRoomCode();
      const check = await pool.query('SELECT 1 FROM rooms WHERE code = $1', [code]);
      exists = check.rows.length > 0;
    }
    const { admin_id, rallye_id } = req.body;
    if (!rallye_id) {
      return res.status(400).json({ error: 'rallye_id ist erforderlich' });
    }
    const result = await pool.query(
      'INSERT INTO rooms (code, status, admin_id, rallye_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [code, 'offen', admin_id || null, rallye_id]
    );
    res.json({ room: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Erstellen des Raums' });
  }
});

// Gibt alle offenen Räume zurück
app.get('/api/rooms', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rooms WHERE status = $1 ORDER BY created_at DESC', ['offen']);
    res.json({ rooms: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden der Räume' });
  }
});

// Schließt einen Raum (Status auf "geschlossen", closed_at setzen)
app.patch('/api/rooms/:id/close', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE rooms SET status = $1, closed_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['geschlossen', id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Raum nicht gefunden' });
    res.json({ room: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Schließen des Raums' });
  }
});




// Server starten (Bitte unten lassen es müssen erst routen, hilfsfunktionen usw. definiert sein)
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
