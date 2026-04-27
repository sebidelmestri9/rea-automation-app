// ===== SIDEBAR =====
function renderSidebar() {
  const nav = document.getElementById('stage-nav');
  const cur = State.currentStage;
  nav.innerHTML = STAGES.map((s, i) => {
    const done = cur > s.id;
    const active = cur === s.id;
    const cls = done ? 'done' : active ? 'active' : '';
    return `
      <div class="step-item ${cls}" onclick="App.goStage(${s.id})" id="step-${s.id}">
        <div class="step-num">${done ? '✓' : s.id}</div>
        <div class="step-label"><strong>${s.label}</strong><span>${s.sub}</span></div>
        ${i < STAGES.length - 1 ? '<div class="step-connector"></div>' : ''}
      </div>`;
  }).join('');

  // ── Generate Report CTA: visible once all 10 stages are reached ──
  if (State.project && cur >= 10) {
    nav.innerHTML += `
      <div style="padding:14px 10px 4px">
        <button
          id="btn-sidebar-report"
          onclick="generateReport()"
          style="
            width:100%;padding:11px 0;
            background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);
            color:#fff;border:none;border-radius:10px;
            font-size:0.85em;font-weight:700;letter-spacing:0.02em;
            cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;
            box-shadow:0 4px 18px rgba(99,102,241,.45);
            animation:reportPulse 2.5s ease-in-out infinite;
          "
        >📑 Generate Report</button>
      </div>`;
  }

  document.getElementById('sidebar-project-name').innerHTML =
    State.project ? `<strong>${esc(State.project.name)}</strong>` : 'No project open';
}


// ===== HOME =====
async function renderHome() {
  setTopbar('Home', 'REA Automation');
  document.getElementById('sidebar-project-name').textContent = 'No project open';
  document.getElementById('stage-nav').innerHTML = '';
  State.project = null; State.papers = [];
  setContent('<div class="loading-overlay"><div class="spinner"></div></div>');
  let projects = [];
  try { projects = await API.get('/api/projects'); } catch(e) { toast('Could not load projects', 'error'); }

  const tiles = projects.length ? projects.map(p => {
    const stage = p.currentStep || 1;
    const pct = Math.round(((stage-1)/10)*100);
    const date = p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '';
    return `<div class="project-tile" onclick="App.openProject('${p.id}')">
      <div class="project-tile-name">${esc(p.name)}</div>
      <div class="project-tile-meta">${date ? `Created ${date}` : ''}</div>
      <div class="project-tile-stage">
        <div class="completion-text"><span>Stage ${stage}/10</span><span>${pct}%</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>
    </div>`;
  }).join('') : `<div class="empty-state"><p>No projects yet. Create your first REA!</p></div>`;

  setContent(`
    <div class="home-hero">
      <h1>Rapid Evidence Assessment</h1>
      <p>Automated EBMgt workflow — from research question to final report.</p>
      <button class="btn btn-primary" style="margin-top:24px" onclick="App.newProject()">+ New REA Project</button>
    </div>
    <div class="project-grid">${tiles}</div>`);
}

// ===== STAGE 1: QUESTION & PICOC =====
async function renderStage1() {
  const p = State.project;
  const picoc = p.picoc || {};
  setTopbar('Stage 1 / 10', 'Research Question & PICOC',
    `<button class="btn btn-primary" onclick="Stages.save1()">Save & Continue →</button>`);

  setContent(`
    <div class="section-heading">Define Your Research Question</div>
    <div class="section-sub">State your management question, then build the PICOC framework.</div>
    <div class="card" style="margin-bottom:20px">
      <div class="form-group">
        <label class="form-label">Research Question *</label>
        <textarea class="form-control" id="q-question" rows="3" placeholder="e.g. What is the effect of flexible working arrangements on employee productivity in SMEs?">${esc(p.question||'')}</textarea>
      </div>
      <button class="btn btn-ai" onclick="Stages.aiPicoc()">✦ Auto-extract PICOC with AI</button>
    </div>
    <div class="card">
      <div class="card-header">
        <div><div class="card-title">PICOC Framework</div><div class="card-subtitle">Population · Intervention · Comparison · Outcome · Context</div></div>
      </div>
      <div class="picoc-grid">
        ${['population','intervention','comparison','outcome','context'].map(k => `
          <div class="form-group">
            <label class="form-label">${k.charAt(0).toUpperCase()+k.slice(1)}</label>
            <textarea class="form-control" id="picoc-${k}" rows="2" placeholder="${picocPH(k)}">${esc((picoc[k]||''))}</textarea>
          </div>`).join('')}
      </div>
    </div>`);
}

function picocPH(k) {
  return ({population:'Employees in SMEs',intervention:'Flexible working',comparison:'Office-based work',outcome:'Productivity, satisfaction',context:'Private sector, UK'})[k]||'';
}

// ===== STAGE 2: PROTOCOL =====
async function renderStage2() {
  const proto = State.project.protocol || {};
  const inc = proto.inclusionCriteria || State.project.inclusionCriteria || [];
  const exc = proto.exclusionCriteria || State.project.exclusionCriteria || [];
  const dbs = proto.databases || State.project.databases || ['semantic_scholar','openalex','pubmed'];
  const dr = State.project.dateRange || { from:2010, to:2026 };

  setTopbar('Stage 2 / 10', 'Research Protocol',
    `<button class="btn btn-secondary" onclick="App.goStage(1)">← Back</button>
     <button class="btn btn-primary" onclick="Stages.save2()">Save & Continue →</button>`);

  setContent(`
    <div class="section-heading">Define Your Protocol</div>
    <div class="section-sub">Set inclusion/exclusion criteria, databases, and date limits before searching.</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
      <div class="card">
        <div class="card-title" style="margin-bottom:14px">✅ Inclusion Criteria</div>
        <ul class="criteria-list" id="inc-list">${inc.map((c,i)=>`<li class="criteria-item">${esc(c)}<button class="remove-btn" onclick="Stages.removeCriteria('inc',${i})">×</button></li>`).join('')}</ul>
        <div style="display:flex;gap:8px">
          <input class="form-control" id="inc-input" placeholder="Add criterion…" onkeydown="if(event.key==='Enter')Stages.addCriteria('inc')">
          <button class="btn btn-success btn-sm" onclick="Stages.addCriteria('inc')">Add</button>
        </div>
      </div>
      <div class="card">
        <div class="card-title" style="margin-bottom:14px">❌ Exclusion Criteria</div>
        <ul class="criteria-list" id="exc-list">${exc.map((c,i)=>`<li class="criteria-item">${esc(c)}<button class="remove-btn" onclick="Stages.removeCriteria('exc',${i})">×</button></li>`).join('')}</ul>
        <div style="display:flex;gap:8px">
          <input class="form-control" id="exc-input" placeholder="Add criterion…" onkeydown="if(event.key==='Enter')Stages.addCriteria('exc')">
          <button class="btn btn-danger btn-sm" onclick="Stages.addCriteria('exc')">Add</button>
        </div>
      </div>
    </div>
    <div class="card" style="margin-bottom:20px">
      <div class="card-title" style="margin-bottom:14px">🗄️ Databases to Search</div>
      <div class="tag-group">
        ${[['semantic_scholar','Semantic Scholar'],['openAlex','OpenAlex'],['pubmed','PubMed']].map(([v,l])=>`
          <label class="tag-check" style="display:flex;align-items:center;gap:6px;cursor:pointer">
            <input type="checkbox" id="db-${v}" value="${v}" ${dbs.includes(v)?'checked':''}><span style="padding:6px 14px;border-radius:100px;border:1px solid var(--border);background:var(--glass);font-size:0.8em">${l}</span>
          </label>`).join('')}
      </div>
    </div>
    <div class="card">
      <div class="card-title" style="margin-bottom:14px">📅 Date Range</div>
      <div style="display:flex;gap:16px;align-items:center">
        <div class="form-group" style="margin:0;flex:1"><label class="form-label">From</label><input class="form-control" type="number" id="date-from" value="${dr.from||2010}"></div>
        <div class="form-group" style="margin:0;flex:1"><label class="form-label">To</label><input class="form-control" type="number" id="date-to" value="${dr.to||2026}"></div>
        <div class="form-group" style="margin:0;flex:2"><label class="form-label">Languages</label><input class="form-control" id="lang" value="${(State.project.languages||['English']).join(', ')}"></div>
      </div>
    </div>`);
}

// ===== STAGE 3: SEARCH =====
async function renderStage3() {
  const ss = State.project.searchStrings || {};
  const dbs = State.project.databases || ['semantic_scholar','openAlex','pubmed'];
  const dbLabels = { semantic_scholar:'Semantic Scholar', openAlex:'OpenAlex', pubmed:'PubMed' };
  const stats = State.project.searchStats || null;

  setTopbar('Stage 3 / 10', 'Literature Search',
    `<button class="btn btn-secondary" onclick="App.goStage(2)">← Back</button>
     <button class="btn btn-primary" onclick="App.goStage(4)">Continue →</button>`);

  setContent(`
    <div class="section-heading">Build & Run Search</div>
    <div class="section-sub">Generate Boolean search strings from PICOC with AI, or write your own, then search all databases.</div>
    <div class="card" style="margin-bottom:20px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div class="card-title">Search Strings</div>
        <button class="btn btn-ai" onclick="Stages.aiSearchStrings()">✦ Generate with AI</button>
      </div>
      ${dbs.map(db => `
        <div class="form-group">
          <label class="form-label">${dbLabels[db]||db}</label>
          <textarea class="form-control" id="ss-${db}" rows="3" placeholder="Boolean search string…">${esc(ss[db]||ss.core||'')}</textarea>
        </div>`).join('')}
    </div>
    <div class="card">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px">
        <div class="card-title">Run Search</div>
        <button class="btn btn-primary" id="btn-search" onclick="Stages.runSearch()">🔍 Search All Databases</button>
        <button class="btn btn-secondary btn-sm" id="btn-poll" onclick="Stages.pollSearch()" style="display:none">↻ Check Results</button>
      </div>
      <div id="search-status"></div>
      ${stats ? `
        <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-top:16px">
          <div class="stat-card"><div class="stat-number">${stats.total||0}</div><div class="stat-label">Total found</div></div>
          <div class="stat-card"><div class="stat-number" style="color:var(--green)">${stats.afterDedup||stats.afterDateFilter||0}</div><div class="stat-label">After deduplication</div></div>
          <div class="stat-card"><div class="stat-number">${(stats.total||0)-(stats.afterDedup||stats.afterDateFilter||0)}</div><div class="stat-label">Duplicates removed</div></div>
        </div>` : ''}
    </div>`);
}

// ===== STAGE 4: DEDUPLICATION =====
async function renderStage4() {
  const stats = State.project.searchStats || {};
  const total = State.papers.length;
  setTopbar('Stage 4 / 10', 'Deduplication',
    `<button class="btn btn-secondary" onclick="App.goStage(3)">← Back</button>
     <button class="btn btn-primary" onclick="App.goStage(5)">Continue to Screening →</button>`);

  setContent(`
    <div class="section-heading">Deduplication Results</div>
    <div class="section-sub">Duplicates removed automatically by DOI and normalised title matching.</div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-number">${stats.total||total}</div><div class="stat-label">Records identified</div></div>
      <div class="stat-card"><div class="stat-number" style="color:var(--red)">${(stats.total||0)-(stats.afterDedup||total)}</div><div class="stat-label">Duplicates removed</div></div>
      <div class="stat-card"><div class="stat-number" style="color:var(--green)">${stats.afterDedup||total}</div><div class="stat-label">Unique records</div></div>
      <div class="stat-card"><div class="stat-number">${total}</div><div class="stat-label">Available to screen</div></div>
    </div>
    <div class="card">
      <p style="color:var(--text2);font-size:0.88em;line-height:1.7">
        ${total} unique records identified across Semantic Scholar, OpenAlex, and PubMed. Deduplication used DOI matching (primary) and normalised title comparison (fallback). All records proceed to title/abstract screening in Stage 5.
      </p>
    </div>`);
}
