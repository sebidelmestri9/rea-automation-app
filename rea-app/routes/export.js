import { Router } from 'express';
import { db } from '../database.js';

const router = Router();

// GET /api/export/:projectId/html — full HTML report
router.get('/:projectId/html', async (req, res) => {
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
  const synthesis   = synthRows[0]?.content || 'Synthesis not yet generated.';
  const stats       = await buildStats(projectId);

  const html = generateHTML(project, papers, extractions, appraisals, synthesis, stats);
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Disposition', `attachment; filename="REA-Report-${Date.now()}.html"`);
  res.send(html);
});

async function buildStats(projectId) {
  const papers    = await db.findWhere('papers',    p => p.projectId === projectId);
  const decisions = await db.findWhere('decisions', d => d.projectId === projectId);
  return {
    total:    papers.length,
    included: decisions.filter(d => d.decision === 'include').length,
    excluded: decisions.filter(d => d.decision === 'exclude').length,
  };
}

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function generateHTML(project, papers, extractions, appraisals, synthesis, stats) {
  const extractMap   = Object.fromEntries(extractions.map(e => [e.paperId, e]));
  const appraisalMap = Object.fromEntries(appraisals.map(a => [a.paperId, a]));
  const today = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });

  const picocRows = Object.entries(project.picoc || {}).map(([k, v]) =>
    `<tr><td><strong>${k.toUpperCase()}</strong></td><td>${esc(v)}</td></tr>`
  ).join('');

  const inclusionRows = (project.inclusionCriteria || []).map(c => `<li>${esc(c)}</li>`).join('');
  const exclusionRows = (project.exclusionCriteria || []).map(c => `<li>${esc(c)}</li>`).join('');

  const paperRows = papers.map((p, i) => {
    const ex = extractMap[p.id] || {};
    const ap = appraisalMap[p.id] || {};
    const authors = (p.authors || []).slice(0, 3).join(', ') + (p.authors?.length > 3 ? ' et al.' : '');
    return `<tr>
      <td>${i + 1}</td>
      <td><a href="${esc(p.url)}" target="_blank">${esc(p.title)}</a></td>
      <td>${esc(authors)}</td>
      <td>${esc(p.year)}</td>
      <td>${esc(p.journal || p.source)}</td>
      <td>${esc(ex.study_design || '—')}</td>
      <td>${esc(ex.sample_size || '—')}</td>
      <td>${esc(ex.workplace_setting || '—')}</td>
      <td>${esc(ex.dog_type || '—')}</td>
      <td>${esc(ex.intervention_duration || '—')}</td>
      <td>${esc((ex.outcomes_measured || []).join(', ') || '—')}</td>
      <td>${esc(ap.overall_rating || '—')}</td>
    </tr>`;
  }).join('');

  const synthHTML = synthesis.split('\n').map(l => l.trim() ? `<p>${esc(l)}</p>` : '').join('');

  const subQHTML = (project.subQuestions || []).map((q, i) =>
    `<li><strong>SQ${i + 1}:</strong> ${esc(q)}</li>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>REA Report – ${esc(project.name)}</title>
<style>
  body { font-family: 'Georgia', serif; max-width: 1100px; margin: 0 auto; padding: 40px; color: #1a1a2e; line-height: 1.7; }
  h1 { color: #16213e; border-bottom: 3px solid #6366f1; padding-bottom: 12px; }
  h2 { color: #0f3460; margin-top: 40px; border-left: 4px solid #6366f1; padding-left: 12px; }
  h3 { color: #533483; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 20px 0; }
  th { background: #6366f1; color: white; padding: 10px 8px; text-align: left; }
  td { padding: 8px; border: 1px solid #e2e8f0; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  .meta { color: #64748b; font-size: 14px; margin-bottom: 30px; }
  .stat-box { display: inline-block; background: #f1f5f9; border-radius: 8px; padding: 16px 24px; margin: 8px; text-align: center; }
  .stat-box .num { font-size: 32px; font-weight: bold; color: #6366f1; }
  .stat-box .lbl { font-size: 12px; color: #64748b; }
  ul { padding-left: 20px; }
  li { margin-bottom: 6px; }
  .synthesis p { margin-bottom: 12px; text-align: justify; }
  a { color: #6366f1; }
  @media print { body { max-width: 100%; padding: 20px; } }
</style>
</head>
<body>
<h1>Rapid Evidence Assessment Report</h1>
<p class="meta"><strong>Topic:</strong> ${esc(project.name)}<br>
<strong>Generated:</strong> ${today}<br>
<strong>Databases searched:</strong> ${(project.databases || []).join(', ')}<br>
<strong>Date range:</strong> ${project.dateRange?.from || 2000}–${project.dateRange?.to || 2026}</p>

<h2>1. Research Question</h2>
<p><strong>Primary Question:</strong> ${esc(project.primaryQuestion)}</p>
<h3>PICOC Framework</h3>
<table><tbody>${picocRows}</tbody></table>
<h3>Sub-questions</h3><ol>${subQHTML}</ol>

<h2>2. Protocol</h2>
<h3>Inclusion Criteria</h3><ul>${inclusionRows}</ul>
<h3>Exclusion Criteria</h3><ul>${exclusionRows}</ul>

<h2>3. Search Results Summary</h2>
<div>
  <div class="stat-box"><div class="num">${stats.total}</div><div class="lbl">Total Retrieved</div></div>
  <div class="stat-box"><div class="num">${stats.included}</div><div class="lbl">Included</div></div>
  <div class="stat-box"><div class="num">${stats.excluded}</div><div class="lbl">Excluded</div></div>
</div>

<h2>4. Included Studies (Data Extraction Table)</h2>
<table>
  <thead><tr>
    <th>#</th><th>Title</th><th>Authors</th><th>Year</th><th>Journal/Source</th>
    <th>Design</th><th>N</th><th>Setting</th><th>Dog Type</th><th>Duration</th><th>Outcomes</th><th>Quality</th>
  </tr></thead>
  <tbody>${paperRows || '<tr><td colspan="12">No included studies yet.</td></tr>'}</tbody>
</table>

<h2>5. Narrative Synthesis</h2>
<div class="synthesis">${synthHTML || '<p>Synthesis not yet generated.</p>'}</div>

<h2>6. Limitations of This Assessment</h2>
<ul>
  <li>Grey literature (dissertations, organisational reports) was not searched.</li>
  <li>Only three databases were searched (PubMed, Semantic Scholar, OpenAlex) due to access constraints.</li>
  <li>AI-assisted screening and extraction may introduce errors; all decisions should be verified by the reviewer.</li>
  <li>Rapid Evidence Assessments are inherently less rigorous than full systematic reviews.</li>
</ul>

<h2>7. Implications for Practice</h2>
<p>This REA provides an evidence base for HR decision-makers and organisational leaders considering pet-friendly workplace policies. Findings should be interpreted alongside organisational context, employee needs, and practical considerations such as allergies and phobias.</p>

<p style="margin-top:40px; font-size:12px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:16px;">
  Generated by REA Automation System | Evidence-Based Management | ${today}
</p>
</body></html>`;
}

export default router;
