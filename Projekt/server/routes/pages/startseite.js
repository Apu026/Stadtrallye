const express = require('express');
const router = express.Router();

// Startseite-specific helpers or endpoints can live here.
// For now this router provides a simple health/info endpoint.
router.get('/info', (req, res) => {
  res.json({ page: 'startseite', ok: true });
});

module.exports = router;
