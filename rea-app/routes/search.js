import { Router } from 'express';
import { db } from '../database.js';
import { search as ssSearch } from '../services/semanticScholar.js';
import { search as pmSearch } from '../services/pubmed.js';
import { search as oaSearch } from '../services/openAlex.js';

const router = Router();

// POST /api/search/:projectId — trigger multi-database search
router.post('/:projectId', async (req, res) => {
  const { projectId } = req.params;
  const project = await db.findById('projects', projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const strings = project.searchStrings || {};
  const ssQuery = strings.semanticScholar || strings.core || 'pet dogs workplace wellbeing stress';
  const pmQuery = strings.pubmed        || strings.core || 'dog workplace stress wellbeing';
  const oaQuery = strings.openAlex      || strings.core || 'dogs workplace employee wellbeing';

  res.json({ message: 'Search started', status: 'running' });

  // Run searches async (fire and forget, results stored in DB)
  runSearches(projectId, ssQuery, pmQuery, oaQuery).catch(err =>
    console.error('[Search] Error:', err.message)
  );
});

async function runSearches(projectId, ssQuery, pmQuery, oaQuery) {
  console.log('[Search] Starting searches for project', projectId);

  const [ssResults, pmResults, oaResults] = await Promise.allSettled([
    ssSearch(ssQuery, 80),
    pmSearch(pmQuery, 80),
    oaSearch(oaQuery, 80),
  ]);

  const allRaw = [
    ...(ssResults.value || []),
    ...(pmResults.value || []),
    ...(oaResults.value || []),
  ].filter(p => p.title && p.title.length > 5);

  console.log(`[Search] Raw results: SS=${ssResults.value?.length ?? 0}, PM=${pmResults.value?.length ?? 0}, OA=${oaResults.value?.length ?? 0}`);

  const deduped = deduplicate(allRaw);
  console.log(`[Search] After dedup: ${deduped.length} unique papers`);

  const filtered = deduped.filter(p => !p.year || (p.year >= 2000 && p.year <= 2026));

  const existing = await db.findWhere('papers', p => p.projectId === projectId);
  const existingDois   = new Set(existing.map(p => p.doi).filter(Boolean));
  const existingTitles = new Set(existing.map(p => normalizeTitle(p.title)));

  let added = 0;
  for (const paper of filtered) {
    const doi = paper.doi;
    const normTitle = normalizeTitle(paper.title);
    if (doi && existingDois.has(doi)) continue;
    if (existingTitles.has(normTitle)) continue;
    await db.insert('papers', { ...paper, projectId, aiScore: null, aiReason: null, aiPico: null });
    if (doi) existingDois.add(doi);
    existingTitles.add(normTitle);
    added++;
  }

  await db.update('projects', projectId, {
    searchCompleted: true,
    searchCompletedAt: new Date().toISOString(),
    searchStats: {
      semanticScholar: ssResults.value?.length ?? 0,
      pubmed:          pmResults.value?.length ?? 0,
      openAlex:        oaResults.value?.length ?? 0,
      total:           allRaw.length,
      afterDedup:      deduped.length,
      afterDateFilter: filtered.length,
      newlyAdded:      added,
    }
  });

  console.log(`[Search] Done. Added ${added} new papers.`);
}

function normalizeTitle(title) {
  return (title || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60);
}

function deduplicate(papers) {
  const seen = new Map();
  const result = [];
  for (const p of papers) {
    const key = p.doi || normalizeTitle(p.title);
    if (!key || seen.has(key)) continue;
    seen.set(key, true);
    result.push(p);
  }
  return result;
}

// GET /api/search/:projectId/results — get all papers
router.get('/:projectId/results', async (req, res) => {
  const papers  = await db.findWhere('papers', p => p.projectId === req.params.projectId);
  const project = await db.findById('projects', req.params.projectId);
  res.json({
    papers,
    searchStats:     project?.searchStats || null,
    searchCompleted: project?.searchCompleted || false,
  });
});

// GET /api/search/:projectId/status — poll search completion
router.get('/:projectId/status', async (req, res) => {
  const project = await db.findById('projects', req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json({
    searchCompleted: project.searchCompleted || false,
    searchStats:     project.searchStats || null,
  });
});

export default router;
