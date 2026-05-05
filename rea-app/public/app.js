// ===== MAIN APP CONTROLLER =====
// Glues api.js + stages-1-4.js + stages-5-10.js together.

const App = {
  // ── Navigation ──────────────────────────────────────────────────────────────
  async goHome() {
    State.project = null;
    State.papers = [];
    State.currentStage = 1;
    await renderHome();
  },

  async openProject(id) {
    try {
      setContent('<div class="loading-overlay"><div class="spinner"></div><span>Loading project…</span></div>');
      await State.loadProject(id);
      renderSidebar();
      localStorage.setItem('rea_last_project', id);
      await this.goStage(State.currentStage || 1);
    } catch(e) {
      toast('Could not open project: ' + e.message, 'error');
      await renderHome();
    }
  },

  async goStage(n) {
    if (!State.project) { await renderHome(); return; }
    State.currentStage = n;
    await State.saveProject({ currentStep: n });
    renderSidebar();
    const renderers = [null,
      renderStage1, renderStage2, renderStage3, renderStage4, renderStage5,
      renderStage6, renderStage7, renderStage8, renderStage9, renderStage10,
      renderStage11
    ];
    if (renderers[n]) await renderers[n]();
  },

  // ── Project lifecycle ────────────────────────────────────────────────────────
  newProject() {
    Modal.open('New REA Project', `
      <div class="form-group">
        <label class="form-label">Project Name</label>
        <input class="form-control" id="np-name" placeholder="e.g. Pet Dogs in the Workplace REA"
               value="Pet Dogs in the Workplace &amp; Employee Well-being">
      </div>
      <div class="form-group" style="display:flex;align-items:center;gap:10px;margin-bottom:0">
        <input type="checkbox" id="np-seed" checked style="width:16px;height:16px;accent-color:var(--accent)">
        <label for="np-seed" style="font-size:0.85em;color:var(--text2);cursor:pointer">Pre-load Pet Dogs workplace protocol</label>
      </div>`,
      [
        { label: 'Cancel', cls: 'btn-secondary', fn: () => Modal.close() },
        { label: 'Create Project', cls: 'btn-primary', fn: () => App._createProject() }
      ]
    );
    setTimeout(() => document.getElementById('np-name')?.focus(), 50);
  },

  async _createProject() {
    const name = document.getElementById('np-name')?.value.trim() || 'New REA Project';
    const useSeed = document.getElementById('np-seed')?.checked ?? true;
    Modal.close();
    try {
      const proj = await API.post('/api/projects', { name, useSeed });
      toast('Project created!', 'success');
      await App.openProject(proj.id);
    } catch(e) {
      toast('Failed to create project: ' + e.message, 'error');
    }
  },

  openSettings() {
    Modal.open('Settings', `
      <div class="form-group">
        <label class="form-label">Gemini API Key</label>
        <input class="form-control" type="password" id="s-key" placeholder="AIza…"
               value="${localStorage.getItem('gemini_key') || ''}">
        <div style="font-size:0.78em;color:var(--text2);margin-top:6px">
          Get a free key at <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:var(--accent)">aistudio.google.com</a> · stored in browser only
        </div>
      </div>`,
      [
        { label: 'Close', cls: 'btn-secondary', fn: () => Modal.close() },
        { label: 'Save', cls: 'btn-primary', fn: () => {
          const v = document.getElementById('s-key')?.value.trim();
          if (v) localStorage.setItem('gemini_key', v);
          Modal.close();
          toast('Settings saved', 'success');
        }}
      ]
    );
  }
};

// ===== STAGE ACTION HANDLERS (Stages.* called from inline onclick) =============
const Stages = {
  // ── Stage 1 ──────────────────────────────────────────────────────────────────
  async aiEnhanceBackground() {
    const text = document.getElementById('bg-text')?.value.trim();
    if (!text) { toast('Write some background notes first', 'warning'); return; }

    const btn = document.getElementById('btn-enhance-bg');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="ai-sparkle">✦</span> Enhancing…'; }
    toast('AI is enhancing your background…', 'info');

    try {
      const res = await API.post(`/api/projects/${State.project.id}/ai-enhance-background`, {
        text,
        question: document.getElementById('q-question')?.value.trim() || ''
      });
      const enhanced = res.enhanced || '';
      const area = document.getElementById('bg-enhanced-area');
      const textEl = document.getElementById('bg-enhanced-text');
      if (area && textEl && enhanced) {
        textEl.innerHTML = enhanced.split(/\n{2,}/).map(p => `<p>${esc(p.trim())}</p>`).join('');
        area.style.display = 'block';
        area.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        toast('Enhancement ready — review and accept or keep your original', 'success');
      }
    } catch(e) {
      toast('AI enhancement failed: ' + e.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<span class="ai-sparkle">✦</span> Enhance with AI'; }
    }
  },

  acceptEnhanced() {
    const textEl = document.getElementById('bg-enhanced-text');
    const textarea = document.getElementById('bg-text');
    if (textEl && textarea) {
      textarea.value = textEl.innerText || textEl.textContent;
      if (typeof updateBgWordCount === 'function') updateBgWordCount();
    }
    this.dismissEnhanced();
    toast('Enhanced version applied ✓', 'success');
  },

  dismissEnhanced() {
    const area = document.getElementById('bg-enhanced-area');
    if (area) area.style.display = 'none';
  },

  clearBackground() {
    const el = document.getElementById('bg-text');
    if (el) { el.value = ''; if (typeof updateBgWordCount === 'function') updateBgWordCount(); }
    this.dismissEnhanced();
  },

  async aiPicoc() {
    const q = document.getElementById('q-question')?.value.trim();
    if (!q) { toast('Enter a research question first', 'warning'); return; }
    toast('AI extracting PICOC…', 'info');
    try {
      const res = await API.post(`/api/projects/${State.project.id}/ai-picoc`, { question: q });
      const picoc = res.picoc || {};
      ['population','intervention','comparison','outcome','context'].forEach(k => {
        const el = document.getElementById('picoc-' + k);
        if (el && picoc[k]) el.value = picoc[k];
      });
      toast('PICOC extracted! Review and save.', 'success');
    } catch(e) {
      toast('AI PICOC failed: ' + e.message, 'error');
    }
  },

  async save1() {
    const backgroundText = document.getElementById('bg-text')?.value.trim() || '';
    const question = document.getElementById('q-question')?.value.trim() || '';
    const picoc = {};
    ['population','intervention','comparison','outcome','context'].forEach(k => {
      picoc[k] = document.getElementById('picoc-' + k)?.value.trim() || '';
    });
    try {
      await State.saveProject({
        background: { text: backgroundText },
        question,
        picoc,
        currentStep: Math.max(State.project.currentStep || 1, 2)
      });
      toast('Stage 1 saved ✓', 'success');
      await App.goStage(2);
    } catch(e) { toast('Save failed: ' + e.message, 'error'); }
  },

    // ── Stage 2 ──────────────────────────────────────────────────────────────────

  async aiPicocAll() {
    toast('AI extracting PICOC from background...', 'info');
    try {
      const res = await API.post(`/api/projects/${State.project.id}/ai-picoc`, { question: State.project.background?.text || '' });
      const picoc = res.picoc || {};
      ['population','intervention','comparison','outcome','context'].forEach(k => {
        const el = document.getElementById('picoc-' + k);
        if (el && picoc[k]) el.value = picoc[k];
      });
      toast('PICOC extracted!', 'success');
    } catch(e) {
      toast('AI PICOC failed: ' + e.message, 'error');
    }
  },

  async aiPicocField(field) {
    toast(`AI suggesting ${field}...`, 'info');
    try {
      const res = await API.post(`/api/projects/${State.project.id}/ai-picoc`, { question: State.project.background?.text || '' });
      const picoc = res.picoc || {};
      const el = document.getElementById('picoc-' + field);
      if (el && picoc[field]) el.value = picoc[field];
      toast(`Suggested ${field}`, 'success');
    } catch(e) {
      toast('AI suggest failed: ' + e.message, 'error');
    }
  },

  composeQuestionFromPicoc() {
    const p = document.getElementById('picoc-population')?.value.trim();
    const i = document.getElementById('picoc-intervention')?.value.trim();
    const c = document.getElementById('picoc-comparison')?.value.trim();
    const o = document.getElementById('picoc-outcome')?.value.trim();
    const ctx = document.getElementById('picoc-context')?.value.trim();
    
    let q = `What is the effect of ${i || '[Intervention]'}`;
    if (c) q += ` compared to ${c}`;
    q += ` on ${o || '[Outcome]'}`;
    q += ` for ${p || '[Population]'}`;
    if (ctx) q += ` in ${ctx}`;
    q += `?`;

    const el = document.getElementById('q-question');
    if (el) el.value = q;
  },

  async aiRefineQuestion() {
    const q = document.getElementById('q-question')?.value.trim();
    if (!q) { toast('Compose or write a draft question first.', 'warning'); return; }
    toast('AI refining question...', 'info');

    const picoc = {};
    ['population','intervention','comparison','outcome','context'].forEach(k => {
      picoc[k] = document.getElementById('picoc-' + k)?.value.trim() || '';
    });

    try {
      const res = await API.post(`/api/projects/${State.project.id}/ai-refine-question`, {
        background: State.project.background?.text || '',
        picoc,
        question: q
      });
      if (res.refined_question) {
        document.getElementById('q-question').value = res.refined_question;
        toast('Question refined!', 'success');
      }
    } catch(e) {
      toast('AI refine failed: ' + e.message, 'error');
    }
  },

  async extractConcepts() {
    const q = document.getElementById('q-question')?.value.trim();
    if (!q) { toast('Draft a research question first.', 'warning'); return; }
    toast('AI extracting concepts...', 'info');

    const picoc = {};
    ['population','intervention','comparison','outcome','context'].forEach(k => {
      picoc[k] = document.getElementById('picoc-' + k)?.value.trim() || '';
    });

    try {
      const res = await API.post(`/api/projects/${State.project.id}/ai-suggest-concepts`, { question: q, picoc });
      if (res.concept_groups) {
        State.project.searchConcepts = res.concept_groups;
        State.project.booleanString = res.boolean_string;
        Stages.renderConceptGroups(res.concept_groups);
        document.getElementById('concept-groups-container').style.display = 'block';
        document.getElementById('boolean-preview-container').style.display = 'block';
        document.getElementById('boolean-preview-text').textContent = res.boolean_string;
        toast('Concepts extracted!', 'success');
      }
    } catch(e) {
      toast('AI concept extraction failed: ' + e.message, 'error');
    }
  },

  renderConceptGroups(groups) {
    const container = document.getElementById('concept-groups-container');
    if (!container) return;

    container.innerHTML = groups.map((g, idx) => `
      <div class="concept-group" style="margin-bottom:12px; padding:12px; background:var(--surface); border-radius:var(--radius-sm); border:1px solid var(--border);">
        <div style="font-weight:600; margin-bottom:8px; font-size:0.9em; display:flex; justify-content:space-between">
          <span>Concept ${idx + 1}: ${esc(g.name)}</span>
        </div>
        <div class="tag-group" style="display:flex; flex-wrap:wrap; gap:8px;">
          ${g.terms.map(t => `<span class="concept-chip" style="padding:4px 10px; background:var(--bg2); border:1px solid var(--border-active); border-radius:16px; font-size:0.85em; display:inline-flex; align-items:center;">${esc(t)}</span>`).join('')}
        </div>
      </div>
      ${idx < groups.length - 1 ? `<div class="bool-connector" style="text-align:center; margin:8px 0; font-weight:700; color:var(--accent);">AND</div>` : ''}
    `).join('');
  },

  async save2() {
    const picoc = {};
    let missingPicoc = false;
    ['population','intervention','comparison','outcome','context'].forEach(k => {
      const val = document.getElementById('picoc-' + k)?.value.trim();
      picoc[k] = val || '';
      if (!val && k !== 'comparison') missingPicoc = true; // comparison is often optional
    });

    const question = document.getElementById('q-question')?.value.trim();
    if (!question) { toast('Please compose a research question', 'warning'); return; }

    const concepts = State.project.searchConcepts;
    if (!concepts || concepts.length === 0) { toast('Please extract search concepts before continuing', 'warning'); return; }

    try {
      await State.saveProject({
        picoc,
        question,
        searchConcepts: concepts,
        booleanString: State.project.booleanString,
        currentStep: Math.max(State.project.currentStep || 1, 3)
      });
      toast('Research Question saved ✓', 'success');
      await App.goStage(3);
    } catch(e) { toast('Save failed: ' + e.message, 'error'); }
  },


  // ── Stage 3 ──────────────────────────────────────────────────────────────────
  _criteria: { inc: [], exc: [] },

  addCriteria(type) {
    const input = document.getElementById(type + '-input');
    const val = input?.value.trim();
    if (!val) return;
    const list = document.getElementById(type + '-list');
    const li = document.createElement('li');
    li.className = 'criteria-item';
    const idx = list.children.length;
    li.innerHTML = `${esc(val)}<button class="remove-btn" onclick="this.parentElement.remove()">×</button>`;
    list.appendChild(li);
    input.value = '';
    input.focus();
  },

  removeCriteria(type, idx) {
    const list = document.getElementById(type + '-list');
    list?.children[idx]?.remove();
  },

  async aiCriteria() {
    const btn = document.getElementById('btn-ai-criteria');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="ai-sparkle">✦</span> Generating...'; }
    toast('AI is analyzing PICOC & benchmarks to suggest criteria...', 'info');

    try {
      const benchmarkText = document.getElementById('benchmark-text')?.value.trim() || '';
      const res = await API.post(`/api/projects/${State.project.id}/ai-criteria`, { benchmarkText });
      const { inclusion, exclusion } = res.criteria || {};
      
      if (inclusion && inclusion.length) {
        const incList = document.getElementById('inc-list');
        inclusion.forEach(c => {
          const li = document.createElement('li');
          li.className = 'criteria-item';
          li.innerHTML = `${esc(c)}<button class="remove-btn" onclick="this.parentElement.remove()">×</button>`;
          incList.appendChild(li);
        });
      }
      
      if (exclusion && exclusion.length) {
        const excList = document.getElementById('exc-list');
        exclusion.forEach(c => {
          const li = document.createElement('li');
          li.className = 'criteria-item';
          li.innerHTML = `${esc(c)}<button class="remove-btn" onclick="this.parentElement.remove()">×</button>`;
          excList.appendChild(li);
        });
      }
      
      toast('Criteria generated! Please review and modify as needed.', 'success');
    } catch(e) {
      toast('AI criteria generation failed: ' + e.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<span class="ai-sparkle">✦</span> Suggest Criteria with AI'; }
    }
  },

  async save3() {
    const getCriteria = (id) => [...document.querySelectorAll(`#${id} li`)].map(li => li.firstChild?.textContent?.trim() || '').filter(Boolean);
    const inclusionCriteria = getCriteria('inc-list');
    const exclusionCriteria = getCriteria('exc-list');
    const benchmarkText = document.getElementById('benchmark-text')?.value.trim() || '';
    
    try {
      await State.saveProject({ inclusionCriteria, exclusionCriteria, benchmarkText, currentStep: Math.max(State.project.currentStep || 1, 3) });
      toast('Protocol saved ✓', 'success');
      await App.goStage(4);
    } catch(e) { toast('Save failed: ' + e.message, 'error'); }
  },

  // ── Stage 4 ──────────────────────────────────────────────────────────────────
  updateDbPreview() {
    const p = State.project;
    const ss = p.searchStrings || {};
    
    // Determine selected DBs
    const ALL_DBS = [
      { id: 'scopus', name: 'Scopus', type: 'boolean' },
      { id: 'wos', name: 'Web of Science', type: 'boolean' },
      { id: 'semantic_scholar', name: 'Semantic Scholar', type: 'semantic' },
      { id: 'openAlex', name: 'OpenAlex', type: 'semantic' },
      { id: 'pubmed', name: 'PubMed', type: 'boolean' },
      { id: 'psycinfo', name: 'PsycINFO', type: 'boolean' },
      { id: 'bsp', name: 'Business Source Premier', type: 'boolean' },
      { id: 'abi', name: 'ABI/INFORM', type: 'boolean' }
    ];

    const selectedIds = ALL_DBS.map(db => db.id).filter(id => document.getElementById('db-' + id)?.checked);
    const selectedDbs = ALL_DBS.filter(db => selectedIds.includes(db.id));

    const booleanDbs = selectedDbs.filter(db => db.type === 'boolean');
    const stringDbs = selectedDbs.filter(db => db.type === 'semantic');

    const container = document.getElementById('dynamic-search-strings');
    if (!container) return;

    if (selectedDbs.length === 0) {
      container.innerHTML = '<div style="color:var(--text3); font-size:0.9em; padding:16px;">Please select at least one database above to build your search strategy.</div>';
      return;
    }

    let html = '<div style="display:grid; gap:20px; margin-top:16px">';

    if (booleanDbs.length > 0) {
      html += `
        <div style="padding:16px; background:var(--bg2); border-radius:var(--radius-sm); border:1px solid var(--border);">
          <div style="font-weight:600; margin-bottom:4px; color:var(--text1);">Exact Boolean Search</div>
          <div style="font-size:0.85em; color:var(--text2); margin-bottom:12px;">These systems use strict Boolean logic (AND, OR, NOT) and support proximity operators.</div>
          <div style="display:grid; gap:12px;">
            ${booleanDbs.map(db => `
              <div class="form-group" style="margin:0">
                <label class="form-label" style="font-size:0.8em">${db.name}</label>
                <textarea class="form-control" id="ss-${db.id}" rows="3" style="font-family:monospace; font-size:0.85em;">${esc(ss[db.id]||ss.core||'')}</textarea>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (stringDbs.length > 0) {
      html += `
        <div style="padding:16px; background:var(--bg2); border-radius:var(--radius-sm); border:1px solid var(--border);">
          <div style="font-weight:600; margin-bottom:4px; color:var(--text1);">Semantic/Keyword String Search</div>
          <div style="font-size:0.85em; color:var(--text2); margin-bottom:12px;">These systems are optimized for natural language or simple keyword strings.</div>
          <div style="display:grid; gap:12px;">
            ${stringDbs.map(db => `
              <div class="form-group" style="margin:0">
                <label class="form-label" style="font-size:0.8em">${db.name}</label>
                <textarea class="form-control" id="ss-${db.id}" rows="2" style="font-family:monospace; font-size:0.85em;">${esc(ss[db.id]||ss.core||'')}</textarea>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    html += '</div>';
    container.innerHTML = html;
  },

  async save4() {
    const ALL_DB_IDS = ['scopus','wos','semantic_scholar','openAlex','pubmed','psycinfo','bsp','abi'];
    const databases = ALL_DB_IDS.filter(id => document.getElementById('db-' + id)?.checked);
    
    const dateRange = {
      from: parseInt(document.getElementById('date-from')?.value) || 2010,
      to: parseInt(document.getElementById('date-to')?.value) || 2026
    };
    const languages = (document.getElementById('lang')?.value || 'English').split(',').map(s => s.trim()).filter(Boolean);

    const searchStrings = {};
    databases.forEach(db => { searchStrings[db] = document.getElementById('ss-' + db)?.value.trim() || ''; });

    try {
      await State.saveProject({ 
        databases, 
        dateRange, 
        languages, 
        searchStrings,
        currentStep: Math.max(State.project.currentStep || 1, 4) 
      });
      toast('Stage 4 saved ✓', 'success');
      await App.goStage(5);
    } catch(e) { toast('Save failed: ' + e.message, 'error'); }
  },
  async aiSearchStrings() {
    toast('AI generating optimized search strings...', 'info');
    
    // First, sync current checked DBs
    const ALL_DB_IDS = ['scopus','wos','semantic_scholar','openAlex','pubmed','psycinfo','bsp','abi'];
    const dbs = ALL_DB_IDS.filter(id => document.getElementById('db-' + id)?.checked);

    if (dbs.length === 0) {
      toast('Please select at least one database first', 'warning');
      return;
    }

    try {
      // Temporarily save selected DBs so API knows what to generate
      await State.saveProject({ databases: dbs });

      const res = await API.post(`/api/projects/${State.project.id}/ai-search-strings`, {});
      const ss = res.searchStrings || {};
      
      dbs.forEach(db => {
        const el = document.getElementById('ss-' + db);
        if (el && ss[db]) el.value = ss[db];
        else if (el && ss.core) el.value = ss.core;
      });
      toast('Search strings generated! Review and run.', 'success');
    } catch(e) {
      // Fallback: auto-compose from PICOC
      const picoc = State.project.picoc || {};
      const base = [picoc.population, picoc.intervention].filter(Boolean).join(' ') || 'dogs workplace wellbeing';
      dbs.forEach(db => { const el = document.getElementById('ss-' + db); if (el && !el.value.trim()) el.value = base; });
      toast('Used PICOC to build search strings (AI unavailable)', 'warning');
    }
  },

  async runSearch() {
    // Save current search strings and filters first
    const ALL_DB_IDS = ['scopus','wos','semantic_scholar','openAlex','pubmed','psycinfo','bsp','abi'];
    const databases = ALL_DB_IDS.filter(id => document.getElementById('db-' + id)?.checked);
    const searchStrings = {};
    databases.forEach(db => { searchStrings[db] = document.getElementById('ss-' + db)?.value.trim() || ''; });
    
    const dateRange = {
      from: parseInt(document.getElementById('date-from')?.value) || 2010,
      to: parseInt(document.getElementById('date-to')?.value) || 2026
    };
    const languages = (document.getElementById('lang')?.value || 'English').split(',').map(s => s.trim()).filter(Boolean);

    await State.saveProject({ searchStrings, databases, dateRange, languages });

    const btn = document.getElementById('btn-search');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Searching API Databases…'; }
    document.getElementById('search-status').innerHTML =
      '<div class="loading-overlay" style="position:relative;height:60px"><div class="spinner"></div><span>Searching databases — this may take 30–60 seconds…</span></div>';

    try {
      await API.post(`/api/search/${State.project.id}`, {});
      // Poll for completion
      let done = false, tries = 0;
      while (!done && tries < 40) {
        await new Promise(r => setTimeout(r, 3000));
        tries++;
        const proj = await API.get(`/api/projects/${State.project.id}`);
        if (proj.searchCompleted) {
          done = true;
          State.project = proj;
          const s = proj.searchStats || {};
          document.getElementById('search-status').innerHTML =
            `<div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-top:0">
               <div class="stat-card"><div class="stat-number">${s.semanticScholar||0}</div><div class="stat-label">Semantic Scholar</div></div>
               <div class="stat-card"><div class="stat-number">${s.pubmed||0}</div><div class="stat-label">PubMed</div></div>
               <div class="stat-card"><div class="stat-number">${s.openAlex||0}</div><div class="stat-label">OpenAlex</div></div>
               <div class="stat-card"><div class="stat-number" style="color:var(--green)">${s.newlyAdded||s.afterDedup||0}</div><div class="stat-label">Unique added</div></div>
             </div>
             <div style="margin-top:16px;padding:14px 18px;background:var(--green-dim);border:1px solid var(--green);border-radius:var(--radius-sm);color:var(--green);font-size:0.88em">
               ✓ Search complete! ${s.newlyAdded||0} unique records saved. Continue to Stage 4 →
             </div>`;
          await State.refreshPapers();
          toast('Search complete!', 'success');
        }
      }
      if (!done) {
        document.getElementById('search-status').innerHTML =
          '<div style="color:var(--amber);font-size:0.88em">⏳ Search still running. Click "Check Results" to poll again.</div>';
        const pollBtn = document.getElementById('btn-poll');
        if (pollBtn) pollBtn.style.display = '';
      }
    } catch(e) {
      document.getElementById('search-status').innerHTML =
        `<div style="color:var(--red);font-size:0.88em">✗ Search failed: ${e.message}</div>`;
      toast('Search failed: ' + e.message, 'error');
    }
    if (btn) { btn.disabled = false; btn.textContent = '🔍 Search All Databases'; }
  },

  async pollSearch() {
    const proj = await API.get(`/api/projects/${State.project.id}`);
    if (proj.searchCompleted) {
      State.project = proj;
      await State.refreshPapers();
      toast(`Search done — ${proj.searchStats?.newlyAdded || 0} papers added`, 'success');
      await renderStage4();
    } else {
      toast('Search still running…', 'info');
    }
  },

  // ── Stage 5 ──────────────────────────────────────────────────────────────────
  async aiScoreAll() {
    toast('AI scoring started — this runs in background (4s per paper)…', 'info');
    try {
      await API.post(`/api/screening/${State.project.id}/ai-score`, {});
      // Poll and refresh every 15s
      let polls = 0;
      const iv = setInterval(async () => {
        polls++;
        await renderStage6();
        if (polls > 30) clearInterval(iv);
      }, 15000);
    } catch(e) { toast('AI scoring error: ' + e.message, 'error'); }
  },

  // ── Stage 7 ──────────────────────────────────────────────────────────────────
  async aiExtractAll() {
    toast('AI extracting all included papers — runs in background…', 'info');
    try {
      await API.post(`/api/extraction/${State.project.id}/ai-extract-all`, {});
      setTimeout(() => renderStage8(), 8000);
    } catch(e) { toast('AI extraction error: ' + e.message, 'error'); }
  },

  async aiExtract(paperId) {
    toast('AI extracting…', 'info');
    try {
      await API.post(`/api/extraction/${State.project.id}/paper/${paperId}/ai`, {});
      setTimeout(() => renderStage8(), 5000);
    } catch(e) { toast('AI error: ' + e.message, 'error'); }
  },

  async saveExtract(paperId) {
    const FIELDS = ['studyDesign','sampleSize','population','intervention','comparison','keyFindings','limitations'];
    const body = {};
    FIELDS.forEach(f => { body[f] = document.getElementById(`ex-${paperId}-${f}`)?.value || ''; });
    try {
      await API.put(`/api/extraction/${State.project.id}/paper/${paperId}`, body);
      toast('Extraction saved ✓', 'success');
    } catch(e) { toast('Save failed: ' + e.message, 'error'); }
  },

  // ── Stage 8 ──────────────────────────────────────────────────────────────────
  _qaCache: {},

  setQa(paperId, criterion, val, btn) {
    if (!Stages._qaCache[paperId]) Stages._qaCache[paperId] = {};
    Stages._qaCache[paperId][criterion] = val;
    // Update button highlights
    const parent = btn.closest('.qa-options');
    parent?.querySelectorAll('.qa-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  },

  async aiAppraiseAll() {
    toast('AI appraising all papers — runs in background…', 'info');
    try {
      await API.post(`/api/appraisal/${State.project.id}/ai-appraise-all`, {});
      setTimeout(() => renderStage9(), 8000);
    } catch(e) { toast('AI appraisal error: ' + e.message, 'error'); }
  },

  async saveAppraisal(paperId) {
    const cached = Stages._qaCache[paperId] || {};
    const overall = document.getElementById(`qa-overall-${paperId}`)?.value || '';
    const notes = document.getElementById(`qa-notes-${paperId}`)?.value || '';
    const body = { ...cached, overall, notes };
    try {
      await API.put(`/api/appraisal/${State.project.id}/paper/${paperId}`, body);
      toast('Appraisal saved ✓', 'success');
    } catch(e) { toast('Save failed: ' + e.message, 'error'); }
  },

  // ── Stage 9 ──────────────────────────────────────────────────────────────────
  async aiImplications() {
    const btn = document.getElementById('btn-ai-impl');
    const spinner = document.getElementById('impl-spinner');
    if (btn) btn.disabled = true;
    if (spinner) spinner.style.display = 'flex';
    toast('Generating practical implications (~10s)…', 'info');
    try {
      const res = await API.post(`/api/synthesis/${State.project.id}/ai-implications`, {});
      const el = document.getElementById('synth-implications');
      if (el && res.implications) el.value = res.implications;
      toast('Implications generated ✓', 'success');
    } catch(e) { toast('AI error: ' + e.message, 'error'); }
    finally {
      if (btn) btn.disabled = false;
      if (spinner) spinner.style.display = 'none';
    }
  },

  async aiLimitations() {
    const btn = document.getElementById('btn-ai-lim');
    const spinner = document.getElementById('lim-spinner');
    if (btn) btn.disabled = true;
    if (spinner) spinner.style.display = 'flex';
    toast('Generating limitations (~10s)…', 'info');
    try {
      const res = await API.post(`/api/synthesis/${State.project.id}/ai-limitations`, {});
      const el = document.getElementById('synth-limitations');
      if (el && res.limitations) el.value = res.limitations;
      toast('Limitations generated ✓', 'success');
    } catch(e) { toast('AI error: ' + e.message, 'error'); }
    finally {
      if (btn) btn.disabled = false;
      if (spinner) spinner.style.display = 'none';
    }
  },

  async aiSynthesis() {
    const spinner = document.getElementById('synth-spinner');
    if (spinner) spinner.style.display = 'flex';
    toast('AI generating synthesis (~30s)…', 'info');
    try {
      await API.post(`/api/synthesis/${State.project.id}/ai-generate`, {});
      // Poll for result
      let tries = 0;
      const iv = setInterval(async () => {
        tries++;
        const s = await API.get(`/api/synthesis/${State.project.id}`);
        if (s?.content && s.content.length > 100) {
          clearInterval(iv);
          const ed = document.getElementById('synthesis-editor');
          if (ed) ed.value = s.content;
          if (spinner) spinner.style.display = 'none';
          toast('Synthesis generated ✓', 'success');
        }
        if (tries > 20) { clearInterval(iv); if (spinner) spinner.style.display = 'none'; }
      }, 4000);
    } catch(e) {
      if (spinner) spinner.style.display = 'none';
      toast('AI synthesis error: ' + e.message, 'error');
    }
  },

  async saveSynthesis() {
    const content = document.getElementById('synthesis-editor')?.value || '';
    const implications = document.getElementById('synth-implications')?.value || '';
    const limitations = document.getElementById('synth-limitations')?.value || '';
    try {
      await API.put(`/api/synthesis/${State.project.id}`, { content, implications, limitations });
      await State.saveProject({ currentStep: Math.max(State.project.currentStep || 1, 11) });
      toast('Synthesis saved ✓', 'success');
      await App.goStage(10);
    } catch(e) { toast('Save failed: ' + e.message, 'error'); }
  }
};

// ===== PROJECT CREATION WITH SEED PROTOCOL =====
// Override the API.post for /api/projects to inject seed data client-side
const _origPost = API.post.bind(API);
API.post = async function(url, body) {
  if (url === '/api/projects' && body?.useSeed) {
    const proj = await _origPost(url, { name: body.name });
    // Load the seed data into the project
    try {
      await _origPost(`/api/projects/${proj.id}/seed`, {});
    } catch(e) {
      // If no seed route, patch it manually
      const seed = {
        currentStep: 1,
        question: 'For employees in various workplace settings, does the presence of pet dogs — employee-owned or therapy — compared to a no-dog environment improve employee well-being (stress, mood, job satisfaction)?',
        picoc: {
          population: 'Employees in various workplace settings (offices, corporate, healthcare, education)',
          intervention: 'Presence of pet dogs in the workplace (employee-owned or therapy/visiting animals)',
          comparison: 'Workplace with no dogs present, or a control/comparison condition',
          outcome: 'Employee well-being: stress, mood, job satisfaction; also engagement, productivity, burnout',
          context: 'Real-world or simulated workplace environments, studies published 2000–2026'
        },
        primaryQuestion: 'For employees in various workplace settings (P), does the presence of any pet dogs — employee-owned or therapy (I) — compared to a no-dog environment (C) improve employee well-being, e.g. stress, mood, job satisfaction (O)?',
        subQuestions: [
          'What types of dog interventions have been studied (employee-owned vs. therapy vs. organisation-owned)?',
          'What workplace settings have been studied (offices, factories, healthcare, education)?',
          'What measures of employee well-being have been used?',
          'What are the effects of dog presence on perceived stress?',
          'What are the effects of dog presence on employee mood?',
          'What are the effects of dog presence on job satisfaction?',
          'Are there any reported negative effects or unintended consequences?',
          'Are the effects consistent across different types of workplaces?',
          'What are the key characteristics of included studies?',
          'What does the evidence suggest for HR decision-makers?'
        ],
        inclusionCriteria: [
          'Published between 2000 and 2026',
          'Published in English',
          'Empirical studies (RCTs, quasi-experimental, cohort, cross-sectional, case-control, qualitative)',
          'Measures at least one outcome: stress, mood, job satisfaction, engagement, productivity, or burnout',
          'Population: employees in workplace settings',
          'Intervention: presence of pet dogs (employee-owned or therapy/visiting)',
          'Conducted in real-world or simulated workplace environments'
        ],
        exclusionCriteria: [
          'Not conducted in workplace or organisational settings',
          'Studies involving animals other than dogs',
          'Studies involving only service or medical assistance animals',
          'Non-empirical studies (reviews, editorials, commentaries, opinion pieces)',
          'Does not measure any specified employee well-being outcome',
          'Published before 2000 or not in English',
          'Focuses exclusively on children or non-employee populations'
        ],
        searchStrings: {
          core: '(dog OR dogs OR "pet dog" OR "therapy dog" OR canine OR "animal-assisted") AND (workplace OR office OR "work environment" OR occupational OR employ*) AND ("well-being" OR wellbeing OR stress OR burnout OR "job satisfaction" OR mood OR anxiety)',
          pubmed: '((dog[tw] OR dogs[tw] OR "pet dog"[tw] OR "therapy dog"[tw] OR canine[tw]) AND (workplace[tw] OR office[tw] OR occupational[tw] OR employee[tw]) AND (wellbeing[tw] OR "well-being"[tw] OR stress[tw] OR burnout[tw] OR "job satisfaction"[tw]))',
          semantic_scholar: 'pet dogs workplace employee wellbeing stress job satisfaction',
          openAlex: 'dogs workplace employee wellbeing stress burnout job satisfaction'
        },
        databases: ['semantic_scholar', 'openAlex', 'pubmed'],
        dateRange: { from: 2000, to: 2026 },
        languages: ['English']
      };
      await _origPost.call({ post: _origPost }, `/api/projects/${proj.id}`, seed).catch(() =>
        fetch(`/api/projects/${proj.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(seed) })
      );
    }
    return proj;
  }
  return _origPost(url, body);
};

// ===== BOOTSTRAP =====
async function init() {
  // Always go home on startup for a "clean slate" as requested
  await renderHome();
}

window.toggleMobileMenu = function(forceClose = false) {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebar-overlay');
  if (!sb) return;
  
  if (forceClose || sb.classList.contains('open')) {
    sb.classList.remove('open');
    if (ov) ov.classList.remove('open');
  } else {
    sb.classList.add('open');
    if (ov) ov.classList.add('open');
  }
};

init();
