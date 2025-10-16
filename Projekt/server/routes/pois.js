const express = require('express');
const { pool, dbEnabled, samplePois } = require('../lib/db');

const router = express.Router();

router.get('/', async (req, res) => {
  if (dbEnabled) {
    try {
      const q = `
        SELECT 
          poi_id AS id,
          poi_name AS name,
          lat,
          long,
          radius_meters AS radius,
          rallye_id
        FROM poi
        ORDER BY poi_id
      `;
      const r = await pool.query(q);

      return res.json({
        pois: r.rows.map(row => ({
          id: row.id,
          name: row.name,
          coords: [Number(row.lat), Number(row.long)],
          radiusMeters: Number(row.radius),
          rallye_id: Number(row.rallye_id)
        }))
      });

    } catch (e) {
      console.warn('DB query for POIs failed, returning sample data instead:', e.message || e);
      return res.json({ pois: samplePois });
    }
  } else {
    res.json({ pois: samplePois });
  }
});

router.post('/', (req, res) => {
  const poi = req.body;
  poi.id = poi.id || `tmp-${Date.now()}`;
  samplePois.push(poi);
  res.json({ poi });
});

module.exports = router;
