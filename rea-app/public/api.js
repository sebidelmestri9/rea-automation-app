// ===== API CLIENT (matches existing ESM backend) =====
const API = {
  async get(url) {
    const r = await fetch(url);
    if (!r.ok) { const t = await r.text(); throw new Error(t); }
    return r.json();
  },
  async post(url, body) {
    const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    if (!r.ok) { const t = await r.text(); throw new Error(t); }
    return r.json();
  },
  async put(url, body) {
    const r = await fetch(url, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    if (!r.ok) { const t = await r.text(); throw new Error(t); }
    return r.json();
  },
  async del(url) {
    const r = await fetch(url, { method:'DELETE' });
    if (!r.ok) { const t = await r.text(); throw new Error(t); }
    return r.json();
  }
};

// ===== STATE =====
const State = {
  project: null,
  papers: [],       // from /api/search/:id/results
  decisions: {},    // paperId -> { ta: decision, ft: decision }
  extractions: {},  // paperId -> extraction obj
  appraisals: {},   // paperId -> appraisal obj
  currentStage: 1,

  async loadProject(id) {
    this.project = await API.get(`/api/projects/${id}`);
    this.currentStage = this.project.currentStep || 1;
    await this.loadPapers(id);
  },

  async loadPapers(id) {
    try {
      const result = await API.get(`/api/search/${id}/results`);
      this.papers = result.papers || [];
      // Build decisions map
      const taDecisions = this.papers.flatMap(p => p.decision ? [{ paperId: p.id, ...p.decision }] : []);
      this.decisions = {};
      this.papers.forEach(p => {
        if (p.decision) this.decisions[p.id] = { ta: p.decision };
      });
    } catch(e) {
      console.warn('Papers not yet loaded:', e.message);
      this.papers = [];
    }
    try {
      // Load screening decisions for all stages
      const screening = await API.get(`/api/screening/${id}?stage=title_abstract`);
      const ftScreening = await API.get(`/api/screening/${id}?stage=full_text`);
      const taMap = {}, ftMap = {};
      (screening || []).forEach(p => { if (p.decision) taMap[p.id] = p.decision; });
      (ftScreening || []).forEach(p => { if (p.decision) ftMap[p.id] = p.decision; });
      this.papers = screening.map(p => ({
        ...p,
        taDecision: taMap[p.id] || null,
        ftDecision: ftMap[p.id] || null
      }));
    } catch(e) {
      console.warn('Screening load error:', e.message);
    }
  },

  async refreshPapers() {
    if (this.project) await this.loadPapers(this.project.id);
  },

  async saveProject(patch) {
    this.project = await API.put(`/api/projects/${this.project.id}`, patch);
  },

  stats() {
    const p = this.papers;
    return {
      total: p.length,
      scored: p.filter(x => x.aiScore != null).length,
      taIncluded: p.filter(x => x.taDecision?.decision === 'include').length,
      taExcluded: p.filter(x => x.taDecision?.decision === 'exclude').length,
      taUnsure:   p.filter(x => x.taDecision?.decision === 'unsure').length,
      taPending:  p.filter(x => !x.taDecision).length,
      ftIncluded: p.filter(x => x.ftDecision?.decision === 'include').length,
      ftExcluded: p.filter(x => x.ftDecision?.decision === 'exclude').length,
    };
  },

  ftIncludedPapers() {
    // papers where full_text decision is include
    return this.papers.filter(p => p.ftDecision?.decision === 'include');
  },
  taIncludedPapers() {
    return this.papers.filter(p => p.taDecision?.decision === 'include' || p.taDecision?.decision === 'unsure');
  }
};

// ===== TOAST =====
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ===== MODAL =====
const Modal = {
  open(title, bodyHTML, actions = []) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    const act = document.getElementById('modal-actions');
    act.innerHTML = '';
    actions.forEach(a => {
      const btn = document.createElement('button');
      btn.className = `btn ${a.cls || 'btn-secondary'}`;
      btn.textContent = a.label;
      btn.onclick = a.fn;
      act.appendChild(btn);
    });
    document.getElementById('modal-overlay').classList.add('open');
  },
  close() { document.getElementById('modal-overlay').classList.remove('open'); }
};
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target.id === 'modal-overlay') Modal.close();
});

// ===== STAGE DEFINITIONS =====
const STAGES = [
  { id: 1, label: 'Research Question', sub: 'Define & PICOC' },
  { id: 2, label: 'Protocol',          sub: 'Criteria & scope' },
  { id: 3, label: 'Literature Search', sub: 'Multi-database' },
  { id: 4, label: 'Deduplication',     sub: 'Clean results' },
  { id: 5, label: 'Title Screening',   sub: 'Include / Exclude' },
  { id: 6, label: 'Full-Text Screen',  sub: 'Confirm inclusion' },
  { id: 7, label: 'Data Extraction',   sub: 'Extract evidence' },
  { id: 8, label: 'Quality Appraisal', sub: 'Rate study quality' },
  { id: 9, label: 'Synthesis',         sub: 'Narrative summary' },
  { id: 10, label: 'Report',           sub: 'Export findings' },
];

// ===== HELPERS =====
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function scoreColor(n) {
  if (n >= 70) return 'var(--green)';
  if (n >= 40) return 'var(--yellow)';
  return 'var(--red)';
}
function setContent(html) { document.getElementById('content').innerHTML = html; }
function setTopbar(stage, title, actionsHTML = '') {
  document.getElementById('topbar-stage').textContent = stage;
  document.getElementById('topbar-title').textContent = title;
  document.getElementById('topbar-actions').innerHTML = actionsHTML;
}
