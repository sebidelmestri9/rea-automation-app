import { Router } from 'express';
import { db } from '../database.js';
import { SEED_PROTOCOL } from '../protocol-seed.js';

const router = Router();

// List all projects
router.get('/', async (req, res) => {
  const projects = await db.all('projects');
  res.json(projects);
});

// Create project (with optional seed protocol)
router.post('/', async (req, res) => {
  const useSeed = req.body.useSeed === true;
  const name = req.body.name || (useSeed ? SEED_PROTOCOL.name : 'New REA Project');
  const data = useSeed
    ? { ...SEED_PROTOCOL, name }
    : {
        name,
        status: 'in_progress',
        currentStep: 1,
        picoc: {},
        primaryQuestion: '',
        subQuestions: [],
        inclusionCriteria: [],
        exclusionCriteria: [],
        searchStrings: {},
        databases: ['PubMed', 'Semantic Scholar', 'OpenAlex'],
        dateRange: { from: 2000, to: 2026 },
        languages: ['English'],
      };
  const project = await db.insert('projects', data);
  res.status(201).json(project);
});

// Get single project
router.get('/:id', async (req, res) => {
  const p = await db.findById('projects', req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(p);
});

// Update project
router.put('/:id', async (req, res) => {
  const updated = await db.update('projects', req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json(updated);
});

// Delete project + all associated data
router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  await db.remove('projects', id);
  await db.removeWhere('papers', p => p.projectId === id);
  await db.removeWhere('decisions', d => d.projectId === id);
  await db.removeWhere('extractions', e => e.projectId === id);
  await db.removeWhere('appraisals', a => a.projectId === id);
  await db.removeWhere('synthesis', s => s.projectId === id);
  res.json({ ok: true });
});

// Project stats (used by Step 12)
router.get('/:id/stats', async (req, res) => {
  const id = req.params.id;
  const papers     = await db.findWhere('papers',     p => p.projectId === id);
  const decisions  = await db.findWhere('decisions',  d => d.projectId === id);
  const extractions= await db.findWhere('extractions',e => e.projectId === id);
  const appraisals = await db.findWhere('appraisals', a => a.projectId === id);
  const synthesis  = await db.findWhere('synthesis',  s => s.projectId === id);
  res.json({
    totalPapers: papers.length,
    included:    decisions.filter(d => d.decision === 'include').length,
    excluded:    decisions.filter(d => d.decision === 'exclude').length,
    unsure:      decisions.filter(d => d.decision === 'unsure').length,
    extracted:   extractions.length,
    appraised:   appraisals.length,
    synthesised: synthesis.length > 0,
  });
});

export default router;
