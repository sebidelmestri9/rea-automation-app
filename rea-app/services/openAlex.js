const BASE = 'https://api.openalex.org/works';

export async function search(query, perPage = 100) {
  try {
    const url = `${BASE}?search=${encodeURIComponent(query)}&filter=publication_year:2000-2026,language:en&per_page=${perPage}&select=id,title,abstract_inverted_index,authorships,publication_year,doi,primary_location,type,open_access`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'REA-Automation/1.0 (mailto:research@uni.edu)' }
    });
    if (!res.ok) throw new Error(`OpenAlex HTTP ${res.status}`);
    const data = await res.json();
    return (data.results || []).map(normalizePaper);
  } catch (err) {
    console.error('[OpenAlex]', err.message);
    return [];
  }
}

function reconstructAbstract(invertedIndex) {
  if (!invertedIndex) return '';
  const words = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) words[pos] = word;
  }
  return words.filter(Boolean).join(' ');
}

function normalizePaper(p) {
  const doi = p.doi ? p.doi.replace('https://doi.org/', '') : null;
  const authors = (p.authorships || []).map(a => a.author?.display_name).filter(Boolean);
  const abstract = reconstructAbstract(p.abstract_inverted_index);
  const url = p.open_access?.oa_url || p.primary_location?.landing_page_url || (doi ? `https://doi.org/${doi}` : '');
  const journal = p.primary_location?.source?.display_name || null;
  return {
    source: 'OpenAlex',
    sourceId: p.id,
    title: p.title || '',
    abstract,
    authors,
    year: p.publication_year || null,
    doi,
    pmid: null,
    url,
    journal,
    publicationType: p.type || null,
  };
}
