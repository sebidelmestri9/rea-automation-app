import { Router } from 'express';
import { db } from '../database.js';
import { extractData } from '../services/gemini.js';

const router = Router();

/**
 * Maps the snake_case Gemini output to the camelCase field names
 * that the Stage 7 frontend reads (studyDesign, sampleSize, etc.)
 */
function mapFields(extracted) {
  return {
    studyDesign:  extracted.study_design || '',
    sampleSize:   extracted.sample_size || '',
    population:   extracted.population_description || extracted.workplace_setting || '',
    intervention: extracted.dog_type || extracted.intervention_duration || '',
    comparison:   extracted.comparison_group || '',
    keyFindings:  extracted.key_findings || '',
    limitations:  extracted.limitations || '',
    // Retain raw fields for appraisal context and export
    outcomes_measured:     extracted.outcomes_measured || [],
    workplace_setting:     extracted.workplace_setting || '',
    dog_type:              extracted.dog_type || '',
    intervention_duration: extracted.intervention_duration || '',
  };
}

// GET all extractions for a project
router.get('/:projectId', async (req, res) => {
  const { projectId } = req.params;
  const included = (await db.findWhere('decisions', d =>
    d.projectId === projectId && d.decision === 'include'
  )).map(d => d.paperId);
  const papers      = await db.findWhere('papers',     p => included.includes(p.id));
  const extractions = await db.findWhere('extractions',e => e.projectId === projectId);
  const extractMap  = Object.fromEntries(extractions.map(e => [e.paperId, e]));
  res.json(papers.map(p => ({ ...p, extraction: extractMap[p.id] || null })));
});

// POST AI extract data for a single paper
router.post('/:projectId/paper/:paperId/ai', async (req, res) => {
  const { projectId, paperId } = req.params;
  const paper = await db.findById('papers', paperId);
  if (!paper) return res.status(404).json({ error: 'Paper not found' });
  try {
    const raw    = await extractData(paper);
    const mapped = mapFields(raw);
    const row    = await db.upsert(
      'extractions',
      e => e.projectId === projectId && e.paperId === paperId,
      { projectId, paperId, ...mapped, aiExtracted: true }
    );
    // Also store on paper for synthesis/appraisal context
    await db.update('papers', paperId, { extractedData: mapped });
    res.json(row);
  } catch (err) {
    console.error('[Extract single]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT manually update extraction (frontend already sends camelCase)
router.put('/:projectId/paper/:paperId', async (req, res) => {
  const { projectId, paperId } = req.params;
  const row = await db.upsert(
    'extractions',
    e => e.projectId === projectId && e.paperId === paperId,
    { projectId, paperId, ...req.body, aiExtracted: false }
  );
  res.json(row);
});

// POST AI extract ALL included papers
router.post('/:projectId/ai-extract-all', async (req, res) => {
  const { projectId } = req.params;
  const included = (await db.findWhere('decisions', d =>
    d.projectId === projectId && d.decision === 'include'
  )).map(d => d.paperId);
  const papers = await db.findWhere('papers', p => included.includes(p.id));
  // Respond immediately so the browser isn't left waiting
  res.json({ message: `Extracting data from ${papers.length} papers...`, count: papers.length });

  for (const paper of papers) {
    try {
      const raw    = await extractData(paper);
      const mapped = mapFields(raw);
      await db.upsert('extractions',
        e => e.projectId === projectId && e.paperId === paper.id,
        { projectId, paperId: paper.id, ...mapped, aiExtracted: true });
      await db.update('papers', paper.id, { extractedData: mapped });
    } catch (err) {
      console.error(`[Extract all] ${paper.id}:`, err.message);
    }
  }
});

export default router;
