// Express-Server und benötigte Pakete importieren
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// DB pool (no SSL as requested)
const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
  ssl: false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// startup DB check
(async () => {
  try {
    const client = await pool.connect();
    try {
      const r = await client.query('SELECT current_database() AS db');
      console.log('Connected to DB:', r.rows[0].db);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('DB startup check failed:', err && err.stack ? err.stack : err);
  }
})();

// root
app.get('/', (req, res) => res.send('Backend läuft!'));

// ===== POI endpoints =====
// GET all POIs
app.get('/api/pois', async (req, res) => {
  try {
    const q = `SELECT poi_id, poi_name, lat, long, radius_meters FROM poi ORDER BY poi_id DESC`;
    const { rows } = await pool.query(q);
    const pois = rows.map(r => ({
      id: r.poi_id,
      name: r.poi_name,
      lat: r.lat != null ? Number(r.lat) : null,
      lng: r.long != null ? Number(r.long) : null,
      radius_meters: r.radius_meters != null ? Number(r.radius_meters) : null,
    }));
    res.json(pois);
  } catch (err) {
    console.error('GET /api/pois error', err && err.stack ? err.stack : err);
    res.status(500).json({ error: 'Could not load POIs' });
  }
});

// GET single POI
app.get('/api/pois/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const q = `SELECT poi_id, poi_name, lat, long, radius_meters FROM poi WHERE poi_id = $1`;
    const { rows } = await pool.query(q, [id]);
    if (!rows.length) return res.status(404).json({ error: 'POI not found' });
    const r = rows[0];
    res.json({
      id: r.poi_id,
      name: r.poi_name,
      lat: r.lat != null ? Number(r.lat) : null,
      lng: r.long != null ? Number(r.long) : null,
      radius_meters: r.radius_meters != null ? Number(r.radius_meters) : null,
    });
  } catch (err) {
    console.error('GET /api/pois/:id error', err && err.stack ? err.stack : err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST create POI
app.post('/api/pois', async (req, res) => {
  try {
    const { name, lat, lng, radius_meters } = req.body || {};
    const q = `INSERT INTO poi (poi_name, lat, long, radius_meters) VALUES ($1,$2,$3,$4) RETURNING poi_id, poi_name, lat, long, radius_meters`;
    const vals = [name || 'Neuer POI', lat != null ? lat : null, lng != null ? lng : null, radius_meters != null ? radius_meters : null];
    const { rows } = await pool.query(q, vals);
    const r = rows[0];
    res.status(201).json({
      id: r.poi_id,
      name: r.poi_name,
      lat: r.lat != null ? Number(r.lat) : null,
      lng: r.long != null ? Number(r.long) : null,
      radius_meters: r.radius_meters != null ? Number(r.radius_meters) : null,
    });
  } catch (err) {
    console.error('POST /api/pois error', err && err.stack ? err.stack : err);
    res.status(500).json({ error: 'Could not create POI' });
  }
});

// PUT update POI
app.put('/api/pois/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, lat, lng, radius_meters } = req.body || {};
    const q = `UPDATE poi SET
                 poi_name = COALESCE($2, poi_name),
                 lat = COALESCE($3, lat),
                 long = COALESCE($4, long),
                 radius_meters = COALESCE($5, radius_meters)
               WHERE poi_id = $1
               RETURNING poi_id, poi_name, lat, long, radius_meters`;
    const vals = [id, name, lat, lng, radius_meters];
    const { rows } = await pool.query(q, vals);
    if (!rows.length) return res.status(404).json({ error: 'POI not found' });
    const r = rows[0];
    res.json({
      id: r.poi_id,
      name: r.poi_name,
      lat: r.lat != null ? Number(r.lat) : null,
      lng: r.long != null ? Number(r.long) : null,
      radius_meters: r.radius_meters != null ? Number(r.radius_meters) : null,
    });
  } catch (err) {
    console.error('PUT /api/pois/:id error', err && err.stack ? err.stack : err);
    res.status(500).json({ error: 'Could not update POI' });
  }
});

// DELETE POI
app.delete('/api/pois/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const q = `DELETE FROM poi WHERE poi_id = $1`;
    const { rowCount } = await pool.query(q, [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'POI not found' });
    res.status(204).end();
  } catch (err) {
    console.error('DELETE /api/pois/:id error', err && err.stack ? err.stack : err);
    res.status(500).json({ error: 'Could not delete POI' });
  }
});

// GET questions for POI
app.get('/api/pois/:id/questions', async (req, res) => {
  try {
    const { id } = req.params;
    const q = `SELECT q_id, poi_id, question, answers, correct_answer_idx FROM question WHERE poi_id = $1 ORDER BY q_id`;
    const { rows } = await pool.query(q, [id]);
    res.json(rows.map(r => ({
      id: r.q_id,
      poi_id: r.poi_id,
      question: r.question,
      answers: r.answers,
      correct_answer_idx: r.correct_answer_idx,
    })));
  } catch (err) {
    console.error('GET /api/pois/:id/questions error', err && err.stack ? err.stack : err);
    res.status(500).json({ error: 'Could not load questions' });
  }
});

// Create question for POI
app.post('/api/pois/:id/questions', async (req, res) => {
  try {
    const poiId = req.params.id;
    const { question, answers, correct_answer_idx } = req.body || {};
    // assume 'answers' column is a text[] in Postgres -> pass JS array and cast to text[]
    const q = `INSERT INTO question (poi_id, question, answers, correct_answer_idx)
               VALUES ($1,$2,$3::text[],$4)
               RETURNING q_id, poi_id, question, answers, correct_answer_idx`;
    const vals = [poiId, question || '', Array.isArray(answers) ? answers : [], correct_answer_idx != null ? Number(correct_answer_idx) : 0];
    const { rows } = await pool.query(q, vals);
    const r = rows[0];
    res.status(201).json({
      id: r.q_id,
      poi_id: r.poi_id,
      question: r.question,
      answers: r.answers, // pg returns text[] as JS array
      correct_answer_idx: r.correct_answer_idx
    });
  } catch (err) {
    console.error('POST /api/pois/:id/questions error', err && err.stack ? err.stack : err);
    res.status(500).json({ error: 'Could not create question' });
  }
});

// Update question
app.put('/api/questions/:qid', async (req, res) => {
  try {
    const qid = req.params.qid;
    const { question, answers, correct_answer_idx } = req.body || {};
    const q = `UPDATE question SET
                 question = COALESCE($2, question),
                 answers = COALESCE($3::text[], answers),
                 correct_answer_idx = COALESCE($4, correct_answer_idx)
               WHERE q_id = $1
               RETURNING q_id, poi_id, question, answers, correct_answer_idx`;
    const vals = [qid, question, Array.isArray(answers) ? answers : null, correct_answer_idx];
    const { rows } = await pool.query(q, vals);
    if (!rows.length) return res.status(404).json({ error: 'Question not found' });
    const r = rows[0];
    res.json({
      id: r.q_id,
      poi_id: r.poi_id,
      question: r.question,
      answers: r.answers,
      correct_answer_idx: r.correct_answer_idx
    });
  } catch (err) {
    console.error('PUT /api/questions/:qid error', err && err.stack ? err.stack : err);
    res.status(500).json({ error: 'Could not update question' });
  }
});

// Delete question
app.delete('/api/questions/:qid', async (req, res) => {
  try {
    const qid = req.params.qid;
    const q = `DELETE FROM question WHERE q_id = $1`;
    const { rowCount } = await pool.query(q, [qid]);
    if (rowCount === 0) return res.status(404).json({ error: 'Question not found' });
    res.status(204).end();
  } catch (err) {
    console.error('DELETE /api/questions/:qid error', err && err.stack ? err.stack : err);
    res.status(500).json({ error: 'Could not delete question' });
  }
});

// ===== Other read endpoints =====

// GET groups
app.get('/api/groups', async (req, res) => {
  try {
    const q = `SELECT group_id, group_name, points, finished, long, lat, session_id, poi_route, poi_done FROM groups ORDER BY group_id`;
    const { rows } = await pool.query(q);
    res.json(rows.map(r => ({
      id: r.group_id,
      name: r.group_name,
      points: r.points,
      finished: r.finished,
      lng: r.long != null ? Number(r.long) : null,
      lat: r.lat != null ? Number(r.lat) : null,
      session_id: r.session_id,
      poi_route: r.poi_route,
      poi_done: r.poi_done,
    })));
  } catch (err) {
    console.error('GET /api/groups error', err && err.stack ? err.stack : err);
    res.status(500).json({ error: 'Could not load groups' });
  }
});

// GET sessions
app.get('/api/sessions', async (req, res) => {
  try {
    const q = `SELECT session_id, rallye_id, entry_code, status FROM session ORDER BY session_id`;
    const { rows } = await pool.query(q);
    res.json(rows.map(r => ({
      id: r.session_id,
      rallye_id: r.rallye_id,
      entry_code: r.entry_code,
      status: r.status,
    })));
  } catch (err) {
    console.error('GET /api/sessions error', err && err.stack ? err.stack : err);
    res.status(500).json({ error: 'Could not load sessions' });
  }
});

// GET rallyes
app.get('/api/rallyes', async (req, res) => {
  try {
    const q = `SELECT rallye_id, name, beschreibung FROM rallye ORDER BY rallye_id`;
    const { rows } = await pool.query(q);
    res.json(rows.map(r => ({
      id: r.rallye_id,
      name: r.name,
      beschreibung: r.beschreibung,
    })));
  } catch (err) {
    console.error('GET /api/rallyes error', err && err.stack ? err.stack : err);
    res.status(500).json({ error: 'Could not load rallyes' });
  }
});

// GET users (lists basic info only)
app.get('/api/users', async (req, res) => {
  try {
    const q = `SELECT user_id, name, role FROM users ORDER BY user_id`;
    const { rows } = await pool.query(q);
    res.json(rows.map(r => ({ id: r.user_id, name: r.name, role: r.role })));
  } catch (err) {
    console.error('GET /api/users error', err && err.stack ? err.stack : err);
    res.status(500).json({ error: 'Could not load users' });
  }
});

// health
app.get('/api/health', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT 1 AS ok');
    res.json({ ok: true, db: rows[0] });
  } catch (err) {
    console.error('GET /api/health error', err && err.stack ? err.stack : err);
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

// global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err && err.stack ? err.stack : err);
  if (!res.headersSent) res.status(500).json({ error: 'Server error' });
});

// start server (default 4000)
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));
