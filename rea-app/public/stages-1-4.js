// ===== SIDEBAR =====
function renderSidebar() {
  const nav = document.getElementById('stage-nav');
  const cur = State.currentStage;
  nav.innerHTML = STAGES.map((s, i) => {
    const done = cur > s.id;
    const active = cur === s.id;
    const cls = done ? 'done' : active ? 'active' : '';
    return `
      <div class="step-item ${cls}" onclick="App.goStage(${s.id}); if(window.toggleMobileMenu) toggleMobileMenu(true)" id="step-${s.id}">
        <div class="step-num">${done ? '✓' : s.id}</div>
        <div class="step-label"><strong>${s.label}</strong><span>${s.sub}</span></div>
        ${i < STAGES.length - 1 ? '<div class="step-connector"></div>' : ''}
      </div>`;
  }).join('');

  // ── Generate Report CTA: visible once all 10 stages are reached ──
  if (State.project && cur >= 11) {
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

// ===== STAGE 1: BACKGROUND, QUESTION & PICOC =====
async function renderStage1() {
  const p = State.project;
  const bg = p.background || {};
  setTopbar('Stage 1 / 11', 'Background',
    `<button class="btn btn-primary" onclick="Stages.save1()">Save & Continue →</button>`);

  setContent(`
    <!-- ══ BACKGROUND SECTION ══ -->
    <div class="section-heading">Step 1: Background</div>
    <div class="section-sub">Describe the problem, its context, and why an REA is needed. Answer the three guiding questions below.</div>

    <div class="background-guide-chips">
      <span class="bg-chip">💡 What is the matter of interest / problem?</span>
      <span class="bg-chip">🏢 What is the context? (sector, history, characteristics)</span>
      <span class="bg-chip">❓ Why is this question important and for whom?</span>
    </div>

    <div class="card bg-card" style="margin-bottom:28px">
      <div class="bg-card-header">
        <div>
          <div class="card-title" style="margin-bottom:4px">📝 Background Statement</div>
          <div style="font-size:13px;color:var(--text2)">Write a rich description of your research problem. You can write rough notes first, then let AI enhance it into a structured, academic paragraph.</div>
        </div>
      </div>

      <textarea id="bg-text" class="form-control bg-textarea" placeholder="Start writing your background notes here..." oninput="updateBgWordCount()">${esc(bg.text||'')}</textarea>
      
      <div class="bg-card-footer">
        <div class="bg-word-count" id="bg-word-count">0 words</div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-secondary btn-sm" onclick="Stages.clearBackground()">Clear All</button>
          <button class="btn btn-ai btn-sm" id="btn-enhance-bg" onclick="Stages.aiEnhanceBackground()">
            <span class="ai-sparkle">✦</span> Enhance with AI
          </button>
        </div>
      </div>
    </div>

    <div id="bg-enhanced-area" style="display:none; margin-bottom:28px">
      <div class="card enhanced-card">
        <div class="enhanced-badge">✨ AI Enhanced Version</div>
        <div id="bg-enhanced-text" class="enhanced-content"></div>
        <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:16px">
          <button class="btn btn-sm btn-secondary" onclick="Stages.dismissEnhanced()">Keep My Original</button>
          <button class="btn btn-sm btn-primary" onclick="Stages.acceptEnhanced()">Apply This Version</button>
        </div>
      </div>
    </div>`);
  
  if (typeof updateBgWordCount === 'function') updateBgWordCount();
}

function updateBgWordCount() {
  const text = document.getElementById('bg-text')?.value || '';
  const count = text.trim() ? text.trim().split(/\s+/).length : 0;
  const el = document.getElementById('bg-word-count');
  if (el) el.textContent = `${count} word${count === 1 ? '' : 's'}`;
}

// ===== STAGE 2: RESEARCH QUESTION & PICOC =====
async function renderStage2() {
  const p = State.project;
  const qt = p.questionType || '';
  const qtSub = p.questionSubType || '';
  const picoc = p.picoc || {};
  const question = p.question || '';

  setTopbar('Stage 2 / 11', 'Research Question',
    `<button class="btn btn-secondary" onclick="App.goStage(1)">← Back</button>
     <button class="btn btn-primary" onclick="Stages.save2()">Save & Continue →</button>`);

  setContent(`
    <div class="section-heading">Step 2: Research Question</div>
    <div class="section-sub">Structure your question using the PICOC framework.</div>
      <div class="card" style="margin-bottom:24px">
        <div class="card-header" style="margin-bottom:16px">
          <div>
            <div class="card-title">PICOC Framework</div>
            <div class="card-subtitle">Define the key elements of your research question.</div>
          </div>
          <button class="btn btn-ai btn-sm" onclick="Stages.aiPicocAll()">✦ Auto-Extract</button>
        </div>
        <div class="picoc-grid" style="display:grid; gap:16px;">
          ${['population','intervention','comparison','outcome','context'].map(k => `
            <div class="form-group" style="margin:0">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px">
                <label class="form-label" style="margin:0; font-size:0.85em; font-weight:700;">${k.toUpperCase()}</label>
                <button style="background:none; border:none; color:var(--accent); font-size:0.75em; cursor:pointer" onclick="Stages.aiPicocField('${k}')">✦ Suggest</button>
              </div>
              <input class="form-control" id="picoc-${k}" value="${esc(picoc[k]||'')}" placeholder="e.g. ${k === 'population' ? 'Office workers' : k === 'intervention' ? 'Pet dogs' : '...'}">
            </div>
          `).join('')}
        </div>
        <button class="btn btn-secondary btn-sm" style="width:100%; margin-top:16px;" onclick="Stages.composeQuestionFromPicoc()">Assemble Question →</button>
      </div>
    <div class="card">
      <div class="card-header">
        <div class="card-title">Final Research Question</div>
        <button class="btn btn-ai btn-sm" onclick="Stages.aiRefineQuestion()">✦ Refine for Academic Rigour</button>
      </div>
      <textarea id="q-question" class="form-control" rows="3" placeholder="Draft your final research question here..." style="font-size:1.1em; font-weight:500; padding:16px;">${esc(question)}</textarea>
      
      <div style="margin-top:20px; display:flex; gap:12px; align-items:center">
        <button class="btn btn-primary" onclick="Stages.extractConcepts()">Extract Search Concepts</button>
        <span style="font-size:0.85em; color:var(--text2)">This will identify the core pillars for your literature search.</span>
      </div>

      <div id="concept-groups-container" style="margin-top:20px; display:${p.searchConcepts ? 'block' : 'none'}">
        ${p.searchConcepts ? Stages.renderConceptGroups(p.searchConcepts) : ''}
      </div>

      <div id="boolean-preview-container" style="margin-top:20px; display:${p.booleanString ? 'block' : 'none'}">
        <div style="font-weight:600; font-size:0.9em; margin-bottom:8px; color:var(--text2)">Boolean String Preview:</div>
        <div id="boolean-preview-text" style="padding:12px; background:var(--bg2); border-radius:var(--radius-sm); font-family:monospace; font-size:0.85em; border:1px dashed var(--border);">
          ${esc(p.booleanString || '')}
        </div>
      </div>
    </div>
  `);
}

// ===== STAGE 3: PROTOCOL & CRITERIA =====
async function renderStage3() {
  const p = State.project;
  setTopbar('Stage 3 / 11', 'Research Protocol & Criteria',
    `<button class="btn btn-secondary" onclick="App.goStage(2)">← Back</button>
     <button class="btn btn-primary" onclick="Stages.save3()">Save & Continue →</button>`);

  setContent(`
    <div class="section-heading">Step 3: Inclusion & Exclusion Criteria</div>
    <div class="section-sub">Define the scope of your assessment. What studies are in and what are out?</div>
    
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:24px;">
      <div class="card">
        <div class="card-header">
          <div class="card-title" style="color:var(--green)">✓ Inclusion Criteria</div>
        </div>
        <div class="criteria-input-group">
          <input class="form-control" id="inc-input" placeholder="e.g. Published after 2010" onkeypress="if(event.key==='Enter') Stages.addCriteria('inc')">
          <button class="btn btn-primary btn-sm" onclick="Stages.addCriteria('inc')">+</button>
        </div>
        <ul class="criteria-list" id="inc-list">
          ${(p.inclusionCriteria||[]).map(c => `<li class="criteria-item">${esc(c)}<button class="remove-btn" onclick="this.parentElement.remove()">×</button></li>`).join('')}
        </ul>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title" style="color:var(--red)">✗ Exclusion Criteria</div>
        </div>
        <div class="criteria-input-group">
          <input class="form-control" id="exc-input" placeholder="e.g. Non-English studies" onkeypress="if(event.key==='Enter') Stages.addCriteria('exc')">
          <button class="btn btn-primary btn-sm" onclick="Stages.addCriteria('exc')">+</button>
        </div>
        <ul class="criteria-list" id="exc-list">
          ${(p.exclusionCriteria||[]).map(c => `<li class="criteria-item">${esc(c)}<button class="remove-btn" onclick="this.parentElement.remove()">×</button></li>`).join('')}
        </ul>
      </div>
    </div>

    <div class="card" style="margin-top:24px">
      <div class="card-header">
        <div>
          <div class="card-title">Criteria Benchmarking</div>
          <div class="card-subtitle">Provide examples of known relevant/irrelevant papers to help AI refine your search.</div>
        </div>
        <button class="btn btn-ai btn-sm" id="btn-ai-criteria" onclick="Stages.aiCriteria()">✦ Suggest Criteria with AI</button>
      </div>
      <textarea id="benchmark-text" class="form-control" rows="3" placeholder="e.g. Smith (2020) is a perfect match because... Jones (2018) is irrelevant because it focuses on cats.">${esc(p.benchmarkText||'')}</textarea>
    </div>
  `);
}

// ===== STAGE 4: LITERATURE SEARCH =====
async function renderStage4() {
  const p = State.project;
  setTopbar('Stage 4 / 11', 'Systematic Keyword Searching',
    `<button class="btn btn-secondary" onclick="App.goStage(3)">← Back</button>
     <button class="btn btn-primary" onclick="Stages.save4()">Save & Continue →</button>`);

  const dbs = p.databases || ['semantic_scholar','openAlex','pubmed'];
  const ss = p.searchStrings || {};

  const ALL_DBS = [
    { id: 'scopus', name: 'Scopus', type: 'boolean', category: 'high_absolute' },
    { id: 'wos', name: 'Web of Science', type: 'boolean', category: 'high_absolute' },
    { id: 'semantic_scholar', name: 'Semantic Scholar', type: 'semantic', category: 'high_absolute' },
    { id: 'openAlex', name: 'OpenAlex', type: 'semantic', category: 'high_absolute' },
    { id: 'pubmed', name: 'PubMed', type: 'boolean', category: 'specialized' },
    { id: 'psycinfo', name: 'PsycINFO', type: 'boolean', category: 'specialized' },
    { id: 'bsp', name: 'Business Source Premier', type: 'boolean', category: 'specialized' },
    { id: 'abi', name: 'ABI/INFORM', type: 'boolean', category: 'specialized' }
  ];

  const renderDbCheckbox = (db) => `
    <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:0.9em; margin-bottom:6px;">
      <input type="checkbox" class="db-checkbox" id="db-${db.id}" ${dbs.includes(db.id)?'checked':''} onchange="Stages.updateDbPreview()">
      ${db.name}
      <span style="font-size:0.7em; padding:2px 6px; border-radius:4px; background:${db.type==='boolean'?'var(--accent-dim)':'var(--green-dim)'}; color:${db.type==='boolean'?'var(--accent)':'var(--green)'}; border:1px solid currentColor;">
        ${db.type === 'boolean' ? 'Boolean & Proximity' : 'Semantic'}
      </span>
    </label>
  `;

  setContent(`
    <div class="section-heading">Step 4: Systematic Keyword Searching</div>
    <div class="section-sub">Develop an effective keyword search strategy and select relevant databases to identify all studies meeting your eligibility criteria.</div>

    <!-- Context Banner -->
    <div style="background:var(--bg2); padding:16px; border-radius:var(--radius-md); border:1px solid var(--border); margin-bottom:24px; display:flex; gap:20px; flex-wrap:wrap;">
      <div style="flex:1; min-width:200px;">
        <div style="font-size:0.8em; font-weight:700; color:var(--text2); text-transform:uppercase; margin-bottom:8px;">Eligibility Criteria (From Stage 3)</div>
        <div style="font-size:0.85em; display:flex; gap:16px;">
          <div><strong style="color:var(--green)">✓ In:</strong> ${(p.inclusionCriteria||[]).length ? (p.inclusionCriteria||[]).join(', ') : 'None specified'}</div>
          <div><strong style="color:var(--red)">✗ Out:</strong> ${(p.exclusionCriteria||[]).length ? (p.exclusionCriteria||[]).join(', ') : 'None specified'}</div>
        </div>
      </div>
    </div>

    <!-- Search Scope & Database Selection -->
    <div class="card" style="margin-bottom:24px">
      <div class="card-header">
        <div>
          <div class="card-title">Search Scope & Database Selection</div>
          <div class="card-subtitle">Balance precision and recall by selecting primary and supplementary systems. Aim for 2+ databases with high absolute coverage and 1+ with specialized coverage.</div>
        </div>
      </div>
      
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:24px; margin-bottom:20px; padding-bottom:20px; border-bottom:1px solid var(--border);">
        <div>
          <div style="font-weight:600; margin-bottom:12px; font-size:0.95em;">High Absolute Coverage (2+ recommended)</div>
          ${ALL_DBS.filter(d => d.category === 'high_absolute').map(renderDbCheckbox).join('')}
        </div>
        <div>
          <div style="font-weight:600; margin-bottom:12px; font-size:0.95em;">Specialized Coverage (1+ recommended)</div>
          ${ALL_DBS.filter(d => d.category === 'specialized').map(renderDbCheckbox).join('')}
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
        <div class="form-group" style="margin:0">
          <label class="form-label">Publication Date Range</label>
          <div style="display:flex; align-items:center; gap:8px">
            <input class="form-control" id="date-from" type="number" value="${p.dateRange?.from||2010}" style="width:80px">
            <span>to</span>
            <input class="form-control" id="date-to" type="number" value="${p.dateRange?.to||2026}" style="width:80px">
          </div>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">Languages</label>
          <input class="form-control" id="lang" value="${(p.languages||['English']).join(', ')}">
        </div>
      </div>
    </div>

    <!-- Keyword Strategy Builder -->
    <div class="card" style="margin-bottom:24px">
      <div class="card-header" style="align-items:flex-start">
        <div>
          <div class="card-title">Keyword Search Strategy</div>
          <div class="card-subtitle" style="max-width:600px;">
            Define building blocks of concepts combined via Boolean logic. 
            <br/><br/>
            <strong>Proximity Operators (e.g. W/2, PRE/3)</strong> are highly recommended for Boolean databases to define concepts composed of sub-concepts (e.g. <code>TITLE-ABS-KEY(remote W/2 work)</code> is better than <code>"remote work"</code>).
          </div>
        </div>
        <button class="btn btn-ai" onclick="Stages.aiSearchStrings()">✦ Generate Strings</button>
      </div>
      
      <div id="dynamic-search-strings">
        <!-- Rendered by updateDbPreview() -->
      </div>

      <div style="margin-top:24px; padding-top:20px; border-top:1px solid var(--border); display:flex; flex-direction:column; align-items:center; gap:12px">
        <button class="btn btn-primary btn-lg" id="btn-search" onclick="Stages.runSearch()" style="padding:12px 32px; font-size:1.05em; box-shadow:0 4px 12px rgba(79,70,229,0.3);">
          🔍 Run Systematic Search
        </button>
        <span style="font-size:0.8em; color:var(--text3); text-align:center; max-width:600px;">
          Note: Only Semantic Scholar, OpenAlex, and PubMed are integrated via free APIs and will be searched automatically. For Scopus, Web of Science, and others, please copy the generated strings and run them manually on their respective websites.
        </span>
      </div>
    </div>

    ${p.searchCompleted ? `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-number">${p.searchStats?.totalRaw || 0}</div>
          <div class="stat-label">Raw Results fetched</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" style="color:var(--accent)">${p.searchStats?.afterDedup || 0}</div>
          <div class="stat-label">After API Deduplication</div>
        </div>
      </div>
    ` : ''}
  `);

  // Initial render of textareas
  if (typeof Stages.updateDbPreview === 'function') {
    setTimeout(() => Stages.updateDbPreview(), 0);
  }
}

// ===== STAGE 5: DEDUPLICATION =====
async function renderStage5() {
  const p = State.project;
  setTopbar('Stage 5 / 11', 'Deduplication',
    `<button class="btn btn-secondary" onclick="App.goStage(4)">← Back</button>
     <button class="btn btn-primary" onclick="App.goStage(6)">Continue →</button>`);

  const stats = p.searchStats || {};
  
  setContent(`
    <div class="section-heading">Step 5: Deduplication</div>
    <div class="section-sub">Cleaning the search results by removing identical or highly similar records.</div>
    
    <div class="card" style="max-width:600px; margin: 0 auto 30px; text-align:center; padding:40px 20px;">
      <div style="font-size:3rem; margin-bottom:20px;">🧹</div>
      <h2 style="margin-bottom:10px;">Results Cleaned</h2>
      <p style="color:var(--text2); margin-bottom:30px;">Identical titles and DOIs have been merged automatically during the search process.</p>
      
      <div class="stats-grid" style="grid-template-columns:1fr 1fr;">
        <div class="stat-card">
          <div class="stat-number">${stats.totalRaw || 0}</div>
          <div class="stat-label">Initial Records</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" style="color:var(--green)">${stats.afterDedup || 0}</div>
          <div class="stat-label">Unique Records</div>
        </div>
      </div>
      
      <div style="margin-top:30px; padding-top:20px; border-top:1px solid var(--border); font-size:0.9em; color:var(--text3)">
        Dropped ${ (stats.totalRaw || 0) - (stats.afterDedup || 0) } duplicates.
      </div>
    </div>
  `);
}
