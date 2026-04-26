import { Router } from 'express';
import { db } from '../database.js';
import { extractData } from '../services/gemini.js';

const router = Router();

// GET all extractions for a project
router.get('/:projectId', (req, res) => {
  const { projectId } = req.params;
  const included = db.findWhere('decisions', d =>
    d.projectId === projectId && d.decision === 'include'
  ).map(d => d.paperId);
  const papers = db.findWhere('papers', p => included.includes(p.id));
  const extractions = db.findWhere('extractions', e => e.projectId === projectId);
  const extractMap = Object.fromEntries(extractions.map(e => [e.paperId, e]));
  res.json(papers.map(p => ({ ...p, extraction: extractMap[p.id] || null })));
});

// POST AI extract data for a paper
router.post('/:projectId/paper/:paperId/ai', async (req, res) => {
  const { projectId, paperId } = req.params;
  const paper = db.findById('papers', paperId);
  if (!paper) return res.status(404).json({ error: 'Paper not found' });
  try {
    const extracted = await extractData(paper);
    const row = db.upsert(
      'extractions',
      e => e.projectId === projectId && e.paperId === paperId,
      { projectId, paperId, ...extracted, aiExtracted: true }
    );
    db.update('papers', paperId, { extractedData: extracted });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT manually update extraction
router.put('/:projectId/paper/:paperId', (req, res) => {
  const { projectId, paperId } = req.params;
  const row = db.upsert(
    'extractions',
    e => e.projectId === projectId && e.paperId === paperId,
    { projectId, paperId, ...req.body, aiExtracted: false }
  );
  res.json(row);
});

// POST AI extract ALL included papers
router.post('/:projectId/ai-extract-all', async (req, res) => {
  const { projectId } = req.params;
  const included = db.findWhere('decisions', d =>
    d.projectId === projectId && d.decision === 'include'
  ).map(d => d.paperId);
  const papers = db.findWhere('papers', p => included.includes(p.id));
  res.json({ message: `Extracting data from ${papers.length} papers...`, count: papers.length });

  for (const paper of papers) {
    try {
      const extracted = await extractData(paper);
      db.upsert('extractions', e => e.projectId === projectId && e.paperId === paper.id,
        { projectId, paperId: paper.id, ...extracted, aiExtracted: true });
      db.update('papers', paper.id, { extractedData: extracted });
    } catch (err) {
      console.error(`[Extract] ${paper.id}:`, err.message);
    }
  }
});

export default router;
