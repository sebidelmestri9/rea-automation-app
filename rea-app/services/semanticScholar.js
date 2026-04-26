const BASE = 'https://api.semanticscholar.org/graph/v1';
const FIELDS = 'title,abstract,authors,year,externalIds,openAccessPdf,publicationTypes,journal';

export async function search(query, limit = 100) {
  const url = `${BASE}/paper/search?query=${encodeURIComponent(query)}&fields=${FIELDS}&limit=${limit}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'REA-Automation/1.0 (academic research)' }
    });
    if (!res.ok) throw new Error(`SS HTTP ${res.status}`);
    const data = await res.json();
    return (data.data || []).map(normalizePaper);
  } catch (err) {
    console.error('[SemanticScholar]', err.message);
    return [];
  }
}

function normalizePaper(p) {
  return {
    source: 'Semantic Scholar',
    sourceId: p.paperId,
    title: p.title || '',
    abstract: p.abstract || '',
    authors: (p.authors || []).map(a => a.name),
    year: p.year || null,
    doi: p.externalIds?.DOI || null,
    pmid: p.externalIds?.PubMed || null,
    url: p.openAccessPdf?.url || `https://www.semanticscholar.org/paper/${p.paperId}`,
    journal: p.journal?.name || null,
    publicationType: (p.publicationTypes || []).join(', ') || null,
  };
}
