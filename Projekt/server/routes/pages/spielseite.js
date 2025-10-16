const express = require('express');
const router = express.Router();

// Spielseite endpoints (e.g., finish session) can be added here.
router.post('/finish', async (req, res) => {
  // this endpoint is called by the frontend when a player finishes early
  // it can be implemented to update session state; for now return ok
  res.json({ success: true });
});

module.exports = router;
