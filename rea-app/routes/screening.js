import { Router } from 'express';
import { db } from '../database.js';
import { scoreRelevance } from '../services/gemini.js';

const router = Router();

// GET all papers with decisions for a project
router.get('/:projectId', (req, res) => {
  const { projectId } = req.params;
  const { stage = 'title_abstract' } = req.query;
  const papers = db.findWhere('papers', p => p.projectId === projectId);
  const decisions = db.findWhere('decisions', d => d.projectId === projectId && d.stage === stage);
  const decisionsMap = Object.fromEntries(decisions.map(d => [d.paperId, d]));
  const result = papers.map(p => ({ ...p, decision: decisionsMap[p.id] || null }));
  res.json(result);
});

// PUT update decision for a paper
router.put('/:projectId/paper/:paperId', (req, res) => {
  const { projectId, paperId } = req.params;
  const { decision, reason, stage = 'title_abstract' } = req.body;
  const row = db.upsert(
    'decisions',
    d => d.projectId === projectId && d.paperId === paperId && d.stage === stage,
    { projectId, paperId, stage, decision, reason, decidedBy: 'human', decidedAt: new Date().toISOString() }
  );
  res.json(row);
});

// POST AI score a batch of papers
router.post('/:projectId/ai-score', async (req, res) => {
  const { projectId } = req.params;
  const project = db.findById('projects', projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const papers = db.findWhere('papers', p => p.projectId === projectId && p.aiScore === null);
  res.json({ message: `Scoring ${papers.length} papers with AI...`, count: papers.length });

  // Async scoring
  for (const paper of papers) {
    try {
      const result = await scoreRelevance(paper, project.picoc || {});
      db.update('papers', paper.id, {
        aiScore: result.score,
        aiReason: result.reason,
        aiPico: result.pico,
        aiRecommendation: result.recommendation,
      });
    } catch (err) {
      console.error(`[AI Score] Paper ${paper.id}:`, err.message);
    }
  }
  console.log('[AI Score] Batch complete');
});

// GET screening stats
router.get('/:projectId/stats', (req, res) => {
  const { projectId } = req.params;
  const papers = db.findWhere('papers', p => p.projectId === projectId);
  const taDecisions = db.findWhere('decisions', d => d.projectId === projectId && d.stage === 'title_abstract');
  const ftDecisions = db.findWhere('decisions', d => d.projectId === projectId && d.stage === 'full_text');
  const scoredPapers = papers.filter(p => p.aiScore !== null);
  res.json({
    total: papers.length,
    scored: scoredPapers.length,
    taScreened: taDecisions.length,
    taIncluded: taDecisions.filter(d => d.decision === 'include').length,
    taExcluded: taDecisions.filter(d => d.decision === 'exclude').length,
    taUnsure: taDecisions.filter(d => d.decision === 'unsure').length,
    ftScreened: ftDecisions.length,
    ftIncluded: ftDecisions.filter(d => d.decision === 'include').length,
    ftExcluded: ftDecisions.filter(d => d.decision === 'exclude').length,
  });
});

export default router;
