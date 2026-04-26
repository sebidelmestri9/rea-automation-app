const ESEARCH = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
const ESUMMARY = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';
const EFETCH = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

export async function search(query, maxResults = 100) {
  try {
    // Step 1: Get PMIDs
    const searchUrl = `${ESEARCH}?db=pubmed&term=${encodeURIComponent(query)}&retmax=${maxResults}&retmode=json&mindate=2000&maxdate=2026&datetype=pdat`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) throw new Error(`PubMed search HTTP ${searchRes.status}`);
    const searchData = await searchRes.json();
    const ids = searchData.esearchresult?.idlist || [];
    if (ids.length === 0) return [];

    await delay(400); // respect rate limit

    // Step 2: Fetch summaries in batches of 50
    const papers = [];
    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50);
      const summaryUrl = `${ESUMMARY}?db=pubmed&id=${batch.join(',')}&retmode=json`;
      const summaryRes = await fetch(summaryUrl);
      if (!summaryRes.ok) continue;
      const summaryData = await summaryRes.json();
      const result = summaryData.result || {};
      for (const id of batch) {
        const item = result[id];
        if (!item) continue;
        papers.push(normalizePaper(item));
      }
      if (i + 50 < ids.length) await delay(400);
    }
    return papers;
  } catch (err) {
    console.error('[PubMed]', err.message);
    return [];
  }
}

function normalizePaper(p) {
  const authors = (p.authors || []).map(a => a.name).filter(Boolean);
  const doi = (p.articleids || []).find(a => a.idtype === 'doi')?.value || null;
  return {
    source: 'PubMed',
    sourceId: p.uid,
    title: p.title?.replace(/<[^>]+>/g, '') || '',
    abstract: '', // abstracts require efetch; populated later if needed
    authors,
    year: p.pubdate ? parseInt(p.pubdate.slice(0, 4)) : null,
    doi,
    pmid: p.uid,
    url: `https://pubmed.ncbi.nlm.nih.gov/${p.uid}/`,
    journal: p.fulljournalname || p.source || null,
    publicationType: (p.pubtype || []).join(', ') || null,
  };
}
