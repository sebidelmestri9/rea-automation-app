const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');

function safeJson(str, fallback) {
  if (!str) return fallback;
  try { return typeof str === 'string' ? JSON.parse(str) : str; }
  catch { return fallback; }
}

function parseProject(p) {
  return {
    ...p,
    picoc: safeJson(p.picoc, {}),
    protocol: safeJson(p.protocol, {}),
    search_strings: safeJson(p.search_strings, {}),
    synthesis: safeJson(p.synthesis, {})
  };
}

function parsePaper(p) {
  return {
    ...p,
    authors: safeJson(p.authors, []),
    extracted_data: safeJson(p.extracted_data, {}),
    quality_appraisal: safeJson(p.quality_appraisal, {}),
    is_duplicate: Boolean(p.is_duplicate)
  };
}

router.get('/', (req, res) => {
  const db = getDb();
  const projects = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all();
  res.json(projects.map(parseProject));
});

router.post('/', (req, res) => {
  const db = getDb();
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const now = new Date().toISOString();
  const id = uuidv4();
  db.prepare('INSERT INTO projects (id,name,created_at,updated_at) VALUES (?,?,?,?)').run(id, name, now, now);
  res.json(parseProject(db.prepare('SELECT * FROM projects WHERE id=?').get(id)));
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const p = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(parseProject(p));
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const allowed = ['name','question','picoc','protocol','search_strings','synthesis','current_stage'];
  const updates = [];
  const values = [];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates.push(`${key} = ?`);
      values.push(typeof req.body[key] === 'object' ? JSON.stringify(req.body[key]) : req.body[key]);
    }
  }
  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
  updates.push('updated_at = ?');
  values.push(new Date().toISOString(), req.params.id);
  db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id=?`).run(...values);
  res.json(parseProject(db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id)));
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM projects WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/:id/papers', (req, res) => {
  const db = getDb();
  const papers = db.prepare('SELECT * FROM papers WHERE project_id=? AND is_duplicate=0').all(req.params.id);
  res.json(papers.map(parsePaper));
});

module.exports = router;
