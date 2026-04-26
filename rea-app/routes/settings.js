const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const gemini = require('../services/gemini');

// Get all settings
router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  // Mask the API key
  if (settings.gemini_key) settings.gemini_key_set = true;
  res.json({ ...settings, gemini_key: undefined, gemini_configured: !!process.env.GEMINI_API_KEY || !!settings.gemini_key });
});

// Save API key
router.post('/gemini-key', (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: 'Key required' });
  process.env.GEMINI_API_KEY = key;
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES ('gemini_key',?)").run(key);
  res.json({ ok: true });
});

// Test Gemini connectivity
router.get('/test-gemini', async (req, res) => {
  try {
    const result = await gemini.parsePicoc('What is the effect of flexible working on employee productivity?');
    res.json({ ok: true, sample: result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
