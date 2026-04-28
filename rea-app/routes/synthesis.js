import { Router } from 'express';
import { db } from '../database.js';
import { generateSynthesis, generateImplications, generateLimitations } from '../services/gemini.js';

const router = Router();

// GET synthesis for a project
router.get('/:projectId', async (req, res) => {
  const rows = await db.findWhere('synthesis', s => s.projectId === req.params.projectId);
  res.json(rows[0] || null);
});

// POST AI generate main narrative synthesis
router.post('/:projectId/ai-generate', async (req, res) => {
  const { projectId } = req.params;
  const project = await db.findById('projects', projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const included = (await db.findWhere('decisions', d =>
    d.projectId === projectId && d.decision === 'include'
  )).map(d => d.paperId);
  const papers = await db.findWhere('papers', p => included.includes(p.id));

  if (papers.length === 0)
    return res.status(400).json({ error: 'No included papers to synthesise' });

  res.json({ message: `Generating synthesis from ${papers.length} papers...` });

  try {
    const text = await generateSynthesis(papers, project.subQuestions || [], project.picoc || {});
    await db.upsert(
      'synthesis',
      s => s.projectId === projectId,
      { projectId, content: text, aiGenerated: true, wordCount: text.split(/\s+/).length }
    );
  } catch (err) {
    console.error('[Synthesis]', err.message);
  }
});

// POST AI generate practical implications
router.post('/:projectId/ai-implications', async (req, res) => {
  const { projectId } = req.params;
  const project = await db.findById('projects', projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const included = (await db.findWhere('decisions', d =>
    d.projectId === projectId && d.decision === 'include'
  )).map(d => d.paperId);
  const papers      = await db.findWhere('papers',      p => included.includes(p.id));
  const extractions = await db.findWhere('extractions', e => e.projectId === projectId);
  const appraisals  = await db.findWhere('appraisals',  a => a.projectId === projectId);
  const synthRows   = await db.findWhere('synthesis',   s => s.projectId === projectId);

  try {
    const text = await generateImplications(project, papers, extractions, appraisals, synthRows[0]?.content || '');
    await db.upsert('synthesis', s => s.projectId === projectId,
      { projectId, implications: text });
    res.json({ implications: text });
  } catch (err) {
    console.error('[Implications]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST AI generate limitations
router.post('/:projectId/ai-limitations', async (req, res) => {
  const { projectId } = req.params;
  const project = await db.findById('projects', projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const included = (await db.findWhere('decisions', d =>
    d.projectId === projectId && d.decision === 'include'
  )).map(d => d.paperId);
  const papers   = await db.findWhere('papers',    p => included.includes(p.id));
  const synthRows= await db.findWhere('synthesis', s => s.projectId === projectId);

  try {
    const text = await generateLimitations(project, papers, synthRows[0]?.content || '');
    await db.upsert('synthesis', s => s.projectId === projectId,
      { projectId, limitations: text });
    res.json({ limitations: text });
  } catch (err) {
    console.error('[Limitations]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT manually update synthesis (saves content + implications + limitations)
router.put('/:projectId', async (req, res) => {
  const row = await db.upsert(
    'synthesis',
    s => s.projectId === req.params.projectId,
    { projectId: req.params.projectId, ...req.body, aiGenerated: false }
  );
  res.json(row);
});

export default router;
