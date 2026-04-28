import { Router } from 'express';
import { db } from '../database.js';
import { prefilQuality } from '../services/gemini.js';

const router = Router();

// GET appraisals for all included papers
router.get('/:projectId', async (req, res) => {
  const { projectId } = req.params;
  const included = (await db.findWhere('decisions', d =>
    d.projectId === projectId && d.decision === 'include'
  )).map(d => d.paperId);
  const papers     = await db.findWhere('papers',    p => included.includes(p.id));
  const appraisals = await db.findWhere('appraisals',a => a.projectId === projectId);
  const appraisalMap = Object.fromEntries(appraisals.map(a => [a.paperId, a]));
  res.json(papers.map(p => ({ paper: p, appraisal: appraisalMap[p.id] || null })));
});

// POST AI pre-fill quality appraisal for one paper
router.post('/:projectId/paper/:paperId/ai', async (req, res) => {
  const { projectId, paperId } = req.params;
  const paper = await db.findById('papers', paperId);
  if (!paper) return res.status(404).json({ error: 'Paper not found' });
  try {
    const quality = await prefilQuality(paper);
    const row = await db.upsert(
      'appraisals',
      a => a.projectId === projectId && a.paperId === paperId,
      { projectId, paperId, ...quality, aiPrefilled: true }
    );
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT manually update appraisal
router.put('/:projectId/paper/:paperId', async (req, res) => {
  const { projectId, paperId } = req.params;
  const row = await db.upsert(
    'appraisals',
    a => a.projectId === projectId && a.paperId === paperId,
    { projectId, paperId, ...req.body }
  );
  res.json(row);
});

// POST AI appraise ALL included papers
router.post('/:projectId/ai-appraise-all', async (req, res) => {
  const { projectId } = req.params;
  const included = (await db.findWhere('decisions', d =>
    d.projectId === projectId && d.decision === 'include'
  )).map(d => d.paperId);
  const papers = await db.findWhere('papers', p => included.includes(p.id));
  res.json({ message: `Appraising ${papers.length} papers...`, count: papers.length });

  for (const paper of papers) {
    try {
      const quality = await prefilQuality(paper);
      await db.upsert('appraisals',
        a => a.projectId === projectId && a.paperId === paper.id,
        { projectId, paperId: paper.id, ...quality, aiPrefilled: true });
    } catch (err) {
      console.error(`[Appraise] ${paper.id}:`, err.message);
    }
  }
});

export default router;
