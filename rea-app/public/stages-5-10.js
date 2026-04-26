// ===== STAGE 5: TITLE/ABSTRACT SCREENING =====
async function renderStage5() {
  // Reload papers with decisions
  let papers = [];
  try {
    const result = await API.get(`/api/screening/${State.project.id}?stage=title_abstract`);
    papers = result || [];
    State.papers = papers;
  } catch(e) { toast('Error loading papers: ' + e.message, 'error'); }

  const total = papers.length;
  const done = papers.filter(p => p.decision && p.decision.decision).length;
  const pct = total ? Math.round((done/total)*100) : 0;
  const filterVal = window._screenFilter || 'all';

  const filtered = papers.filter(p => {
    const d = p.decision?.decision;
    if (filterVal === 'pending') return !d;
    if (filterVal === 'included') return d === 'include';
    if (filterVal === 'excluded') return d === 'exclude';
    if (filterVal === 'unsure') return d === 'unsure';
    return true;
  });

  setTopbar('Stage 5 / 10', 'Title & Abstract Screening',
    `<button class="btn btn-secondary" onclick="App.goStage(4)">← Back</button>
     <button class="btn btn-ai" onclick="Stages.aiScoreAll()">✦ AI Score All</button>
     <button class="btn btn-primary" onclick="App.goStage(6)">Continue →</button>`);

  setContent(`
    <div class="completion-bar">
      <div class="completion-text"><span>Screened: ${done} / ${total}</span><span>${pct}%</span></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap">
      ${['all','pending','included','excluded','unsure'].map(f=>`
        <button class="btn btn-sm ${filterVal===f?'btn-primary':'btn-secondary'}" onclick="window._screenFilter='${f}';renderStage5()">${f.charAt(0).toUpperCase()+f.slice(1)}</button>`).join('')}
      <span style="margin-left:auto;font-size:0.8em;color:var(--text2);align-self:center">Showing ${filtered.length} of ${total}</span>
    </div>
    <div id="paper-list">
      ${filtered.length ? filtered.map(p => renderPaperCard5(p)).join('') : '<div class="empty-state"><p>No papers in this filter.</p></div>'}
    </div>`);
}

function renderPaperCard5(p) {
  const dec = p.decision?.decision || null;
  const cls = {include:'included',exclude:'excluded',unsure:'unsure'}[dec] || '';
  const authors = (p.authors||[]).slice(0,3).join(', ') + ((p.authors||[]).length>3?' et al.':'');
  const score = p.aiScore != null;
  const scoreHTML = score ? `<div class="ai-score">
    <span>AI: ${Math.round(p.aiScore)}%</span>
    <div class="ai-score-bar"><div class="ai-score-fill" style="width:${p.aiScore}%;background:${scoreColor(p.aiScore)}"></div></div>
    ${p.aiRecommendation ? `<span class="badge badge-${p.aiRecommendation}" style="font-size:0.7em">${p.aiRecommendation}</span>` : ''}
  </div>` : '';
  const tldr = p.tldr ? `<p style="font-size:0.8em;color:var(--accent2);margin-bottom:8px;font-style:italic">TLDR: ${esc(p.tldr)}</p>` : '';
  const source = (p.source||'').replace(/_/g,' ');

  return `<div class="paper-card ${cls}" id="pc-${p.id}">
    <div class="paper-title">${esc(p.title)}</div>
    <div class="paper-meta">
      <span>${esc(authors)||'Unknown'}</span><span>${p.year||'n/d'}</span>
      <span class="badge badge-source">${source}</span>
      ${p.doi ? `<a href="https://doi.org/${esc(p.doi)}" target="_blank" style="color:var(--accent);font-size:0.82em">DOI ↗</a>` : ''}
    </div>
    ${tldr}
    <p class="paper-abstract collapsed" id="abs-${p.id}">${esc(p.abstract||'No abstract available.')}</p>
    <button style="background:none;border:none;color:var(--text3);font-size:0.75em;cursor:pointer;margin-bottom:10px" onclick="toggleAbs('${p.id}')">Show more/less</button>
    <div class="paper-actions">
      <button class="btn btn-xs ${dec==='include'?'btn-success':'btn-secondary'}" onclick="screen5('${p.id}','include')">✓ Include</button>
      <button class="btn btn-xs ${dec==='exclude'?'btn-danger':'btn-secondary'}" onclick="screen5('${p.id}','exclude')">✗ Exclude</button>
      <button class="btn btn-xs ${dec==='unsure'?'btn-ai':'btn-secondary'}" onclick="screen5('${p.id}','unsure')">? Unsure</button>
      ${scoreHTML}
    </div>
    ${p.aiReason ? `<p style="font-size:0.75em;color:var(--text2);margin-top:8px;font-style:italic">AI: ${esc(p.aiReason)}</p>` : ''}
  </div>`;
}

function toggleAbs(id) { document.getElementById('abs-'+id)?.classList.toggle('collapsed'); }

async function screen5(paperId, decision) {
  try {
    await API.put(`/api/screening/${State.project.id}/paper/${paperId}`, { decision, stage:'title_abstract' });
    const card = document.getElementById('pc-'+paperId);
    if (card) {
      card.classList.remove('included','excluded','unsure');
      if (decision === 'include') card.classList.add('included');
      if (decision === 'exclude') card.classList.add('excluded');
      if (decision === 'unsure') card.classList.add('unsure');
    }
  } catch(e) { toast('Error saving: ' + e.message, 'error'); }
}

// ===== STAGE 6: FULL-TEXT SCREENING =====
async function renderStage6() {
  let papers = [];
  try {
    const taAll = await API.get(`/api/screening/${State.project.id}?stage=title_abstract`);
    const taIncluded = taAll.filter(p => p.decision?.decision === 'include' || p.decision?.decision === 'unsure');
    const ftAll = await API.get(`/api/screening/${State.project.id}?stage=full_text`);
    const ftMap = Object.fromEntries(ftAll.map(p => [p.id, p.decision]));
    papers = taIncluded.map(p => ({ ...p, ftDecision: ftMap[p.id] || null }));
  } catch(e) { toast('Error: ' + e.message, 'error'); }

  const done = papers.filter(p => p.ftDecision).length;
  const pct = papers.length ? Math.round((done/papers.length)*100) : 0;

  setTopbar('Stage 6 / 10', 'Full-Text Screening',
    `<button class="btn btn-secondary" onclick="App.goStage(5)">← Back</button>
     <button class="btn btn-primary" onclick="App.goStage(7)">Continue →</button>`);

  setContent(`
    <div class="section-heading">Full-Text Screening</div>
    <div class="section-sub">Review ${papers.length} papers that passed title screening. Access full text, then confirm include/exclude.</div>
    <div class="completion-bar" style="margin-bottom:20px">
      <div class="completion-text"><span>Reviewed: ${done} / ${papers.length}</span><span>${pct}%</span></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>
    ${papers.map(p => {
      const dec = p.ftDecision?.decision;
      const cls = dec === 'include' ? 'included' : dec === 'exclude' ? 'excluded' : '';
      const authors = (p.authors||[]).slice(0,3).join(', ');
      return `<div class="paper-card ${cls}" id="ft-${p.id}">
        <div class="paper-title">${esc(p.title)}</div>
        <div class="paper-meta">
          <span>${esc(authors)||'Unknown'}</span><span>${p.year||'n/d'}</span>
          ${p.doi?`<a href="https://doi.org/${esc(p.doi)}" target="_blank" class="btn btn-xs btn-secondary">Full text ↗</a>`
          : p.url?`<a href="${esc(p.url)}" target="_blank" class="btn btn-xs btn-secondary">Link ↗</a>`:''}
        </div>
        <p class="paper-abstract collapsed">${esc(p.abstract||'No abstract.')}</p>
        <div class="paper-actions" style="margin-top:12px">
          <button class="btn btn-xs ${dec==='include'?'btn-success':'btn-secondary'}" onclick="screen6('${p.id}','include')">✓ Include</button>
          <button class="btn btn-xs ${dec==='exclude'?'btn-danger':'btn-secondary'}" onclick="screen6('${p.id}','exclude')">✗ Exclude</button>
          <input class="form-control" style="flex:1;padding:5px 10px;font-size:0.8em" placeholder="Reason for exclusion…" id="ft-reason-${p.id}" value="${esc(p.ftDecision?.reason||'')}">
        </div>
      </div>`;
    }).join('') || '<div class="empty-state"><p>No papers passed title screening.</p></div>'}`);
}

async function screen6(paperId, decision) {
  const reason = document.getElementById('ft-reason-'+paperId)?.value || '';
  try {
    await API.put(`/api/screening/${State.project.id}/paper/${paperId}`, { decision, reason, stage:'full_text' });
    const card = document.getElementById('ft-'+paperId);
    if (card) { card.classList.remove('included','excluded'); card.classList.add(decision==='include'?'included':'excluded'); }
    toast(`Paper ${decision}d`, 'success');
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

// ===== STAGE 7: DATA EXTRACTION =====
async function renderStage7() {
  let papers = [];
  try { papers = await API.get(`/api/extraction/${State.project.id}`); } catch(e) { toast('Error: '+e.message,'error'); }

  const FIELDS = ['studyDesign','sampleSize','population','intervention','comparison','keyFindings','limitations'];
  setTopbar('Stage 7 / 10', 'Data Extraction',
    `<button class="btn btn-secondary" onclick="App.goStage(6)">← Back</button>
     <button class="btn btn-ai" onclick="Stages.aiExtractAll()">✦ AI Extract All</button>
     <button class="btn btn-primary" onclick="App.goStage(8)">Continue →</button>`);

  setContent(`
    <div class="section-heading">Data Extraction</div>
    <div class="section-sub">${papers.length} included papers. Fill in fields manually or use AI to auto-extract.</div>
    ${papers.map(p => {
      const ex = p.extraction || p.extractedData || {};
      const authors = (p.authors||[]).slice(0,2).join(', ');
      return `<div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div><div class="card-title">${esc(p.title)}</div><div class="card-subtitle">${esc(authors)} · ${p.year||'n/d'}</div></div>
          <button class="btn btn-ai btn-sm" onclick="Stages.aiExtract('${p.id}')">✦ AI Extract</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          ${FIELDS.map(f=>`<div class="form-group" style="margin:0;${f==='keyFindings'||f==='limitations'?'grid-column:1/-1':''}">
            <label class="form-label">${f.replace(/([A-Z])/g,' $1').trim()}</label>
            <textarea class="form-control" id="ex-${p.id}-${f}" rows="${f==='keyFindings'||f==='limitations'?3:2}">${esc(ex[f]||'')}</textarea>
          </div>`).join('')}
        </div>
        <button class="btn btn-secondary btn-sm" style="margin-top:12px" onclick="Stages.saveExtract('${p.id}')">Save this paper</button>
      </div>`;
    }).join('') || '<div class="empty-state"><p>No included papers to extract from.</p></div>'}`);
}

// ===== STAGE 8: QUALITY APPRAISAL =====
async function renderStage8() {
  let items = [];
  try { items = await API.get(`/api/appraisal/${State.project.id}`); } catch(e) { toast('Error: '+e.message,'error'); }

  const QA = [
    'Was the research design appropriate to address the research question?',
    'Was the sampling strategy appropriate and justified?',
    'Were data collected in a way that addressed the research issue?',
    'Was the data analysis sufficiently rigorous?',
    'Is there a clear and coherent statement of findings?',
    'How transferable/applicable are the findings to management practice?'
  ];

  setTopbar('Stage 8 / 10', 'Quality Appraisal',
    `<button class="btn btn-secondary" onclick="App.goStage(7)">← Back</button>
     <button class="btn btn-ai" onclick="Stages.aiAppraiseAll()">✦ AI Appraise All</button>
     <button class="btn btn-primary" onclick="App.goStage(9)">Continue →</button>`);

  setContent(`
    <div class="section-heading">Quality Appraisal</div>
    <div class="section-sub">Rate each included study using the EBMgt quality checklist.</div>
    ${items.map(({paper: p, appraisal: qa}) => {
      qa = qa || {};
      return `<div class="card" style="margin-bottom:24px">
        <div class="card-header">
          <div><div class="card-title">${esc(p.title)}</div><div class="card-subtitle">${(p.authors||[])[0]||'Unknown'} · ${p.year||'n/d'}</div></div>
          <select class="form-control" style="width:160px" id="qa-overall-${p.id}">
            <option value="" ${!qa.overall?'selected':''}>Overall quality…</option>
            <option value="high" ${qa.overall==='high'?'selected':''}>High Quality</option>
            <option value="medium" ${qa.overall==='medium'?'selected':''}>Medium Quality</option>
            <option value="low" ${qa.overall==='low'?'selected':''}>Low Quality</option>
          </select>
        </div>
        <div class="qa-grid">
          ${QA.map((q,i)=>{
            const k='q'+(i+1); const v=qa[k]||qa.criteria?.[k];
            return `<div class="qa-item">
              <div class="qa-question">${i+1}. ${q}</div>
              <div class="qa-options">
                <button class="qa-btn yes ${v==='yes'?'active':''}" onclick="Stages.setQa('${p.id}','${k}','yes',this)">Yes</button>
                <button class="qa-btn partial ${v==='partial'?'active':''}" onclick="Stages.setQa('${p.id}','${k}','partial',this)">Partial</button>
                <button class="qa-btn no ${v==='no'?'active':''}" onclick="Stages.setQa('${p.id}','${k}','no',this)">No</button>
              </div>
            </div>`;
          }).join('')}
        </div>
        <div class="form-group" style="margin-top:14px;margin-bottom:0">
          <label class="form-label">Notes</label>
          <textarea class="form-control" id="qa-notes-${p.id}" rows="2">${esc(qa.notes||'')}</textarea>
        </div>
        <button class="btn btn-secondary btn-sm" style="margin-top:12px" onclick="Stages.saveAppraisal('${p.id}')">Save appraisal</button>
      </div>`;
    }).join('') || '<div class="empty-state"><p>No included papers to appraise.</p></div>'}`);
}

// ===== STAGE 9: SYNTHESIS =====
async function renderStage9() {
  let synth = null;
  try { synth = await API.get(`/api/synthesis/${State.project.id}`); } catch(e) {}
  const content = synth?.content || '';

  setTopbar('Stage 9 / 10', 'Evidence Synthesis',
    `<button class="btn btn-secondary" onclick="App.goStage(8)">← Back</button>
     <button class="btn btn-primary" onclick="Stages.saveSynthesis()">Save & Continue →</button>`);

  setContent(`
    <div class="section-heading">Narrative Synthesis</div>
    <div class="section-sub">Synthesise the evidence from included studies. Generate with AI or write manually.</div>
    <div class="card" style="margin-bottom:20px">
      <div class="card-header">
        <div class="card-title">Narrative</div>
        <button class="btn btn-ai" onclick="Stages.aiSynthesis()">✦ Generate with AI</button>
      </div>
      <div id="synth-spinner" style="display:none" class="loading-overlay"><div class="spinner"></div><span>Generating…</span></div>
      <textarea id="synthesis-editor" rows="14" placeholder="Write or generate your narrative synthesis here…">${esc(content)}</textarea>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div class="card">
        <label class="form-label">Practical Implications</label>
        <textarea class="form-control" id="synth-implications" rows="4" placeholder="What do findings mean for management practice?">${esc(synth?.implications||'')}</textarea>
      </div>
      <div class="card">
        <label class="form-label">Limitations of this REA</label>
        <textarea class="form-control" id="synth-limitations" rows="4" placeholder="Acknowledge scope, bias, recency…">${esc(synth?.limitations||'')}</textarea>
      </div>
    </div>`);
}

// ===== STAGE 10: REPORT =====
async function renderStage10() {
  let stats = {};
  try {
    const sc = await API.get(`/api/screening/${State.project.id}/stats`);
    stats = sc;
  } catch(e) {}

  setTopbar('Stage 10 / 10', 'Final Report',
    `<button class="btn btn-secondary" onclick="App.goStage(9)">← Back</button>
     <button class="btn btn-primary" onclick="window.open('/api/export/${State.project.id}/html','_blank')">📄 Open Report</button>`);

  setContent(`
    <div class="section-heading">🎉 REA Complete</div>
    <div class="section-sub">Your Rapid Evidence Assessment is ready. Open the report to review all findings.</div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-number">${stats.total||0}</div><div class="stat-label">Records screened</div></div>
      <div class="stat-card"><div class="stat-number">${stats.taIncluded||0}</div><div class="stat-label">After title screening</div></div>
      <div class="stat-card"><div class="stat-number" style="color:var(--green)">${stats.ftIncluded||0}</div><div class="stat-label">Included studies</div></div>
      <div class="stat-card"><div class="stat-number">${(stats.taExcluded||0)+(stats.ftExcluded||0)}</div><div class="stat-label">Excluded</div></div>
    </div>
    <div class="card">
      <div class="card-title" style="margin-bottom:16px">Report Contents</div>
      <ul style="color:var(--text2);font-size:0.88em;line-height:2;padding-left:20px">
        <li>Research question & PICOC framework</li>
        <li>Methods: inclusion/exclusion criteria, databases, date filters</li>
        <li>PRISMA-style search flow</li>
        <li>Evidence table with quality ratings</li>
        <li>Narrative synthesis</li>
        <li>Implications & limitations</li>
        <li>Full reference list</li>
      </ul>
      <div style="margin-top:20px;display:flex;gap:12px">
        <button class="btn btn-primary" onclick="window.open('/api/export/${State.project.id}/html','_blank')">📄 Open Full Report</button>
        <button class="btn btn-secondary" onclick="window.open('/api/export/${State.project.id}/html','_blank');setTimeout(()=>toast('Use Ctrl+P → Save as PDF','info'),1000)">🖨 Print to PDF</button>
      </div>
    </div>`);
}
