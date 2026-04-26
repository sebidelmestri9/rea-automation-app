import { Router } from 'express';
import { db } from '../database.js';
import { generateSynthesis } from '../services/gemini.js';

const router = Router();

// GET synthesis for a project
router.get('/:projectId', (req, res) => {
  const rows = db.findWhere('synthesis', s => s.projectId === req.params.projectId);
  res.json(rows[0] || null);
});

// POST AI generate synthesis
router.post('/:projectId/ai-generate', async (req, res) => {
  const { projectId } = req.params;
  const project = db.findById('projects', projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const included = db.findWhere('decisions', d =>
    d.projectId === projectId && d.decision === 'include'
  ).map(d => d.paperId);
  const papers = db.findWhere('papers', p => included.includes(p.id));

  if (papers.length === 0)
    return res.status(400).json({ error: 'No included papers to synthesise' });

  res.json({ message: `Generating synthesis from ${papers.length} papers...` });

  try {
    const text = await generateSynthesis(papers, project.subQuestions || [], project.picoc || {});
    db.upsert(
      'synthesis',
      s => s.projectId === projectId,
      { projectId, content: text, aiGenerated: true, wordCount: text.split(/\s+/).length }
    );
  } catch (err) {
    console.error('[Synthesis]', err.message);
  }
});

// PUT manually update synthesis
router.put('/:projectId', (req, res) => {
  const row = db.upsert(
    'synthesis',
    s => s.projectId === req.params.projectId,
    { projectId: req.params.projectId, content: req.body.content, aiGenerated: false }
  );
  res.json(row);
});

export default router;
