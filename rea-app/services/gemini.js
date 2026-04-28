import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// gemini-flash-latest: always resolves to the current best available flash model
// Use this alias to avoid hitting per-model daily quota caps on specific model names
const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Call Gemini with automatic retry on 429 rate-limit errors.
 * Waits the time the API suggests before retrying (up to 3 attempts).
 */
async function ask(prompt) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      lastErr = err;
      const msg = err.message || '';
      // Parse "retry in X.Ys" — use float parse to avoid capturing decimal digits
      const match = msg.match(/retry in (\d+(?:\.\d+)?)\s*s/i);
      const waitSec = match ? Math.ceil(parseFloat(match[1])) + 3 : 15;
      if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
        console.warn(`[Gemini] Rate limited. Waiting ${waitSec}s before retry ${attempt + 1}/3…`);
        await delay(waitSec * 1000);
      } else {
        throw err;
      }
    }
  }
  throw lastErr;
}

async function askJSON(prompt) {
  const raw = await ask(prompt + '\n\nRespond with ONLY valid JSON, no markdown fences.');
  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Gemini did not return valid JSON: ' + raw.slice(0, 200));
  }
}

// Rate limit: 15 req/min free tier → 1 call per ~5s to be safe
async function rateDelay() { await delay(5000); }

export async function scoreRelevance(paper, picoc) {
  await rateDelay();
  const prompt = `You are an expert research screener for a Rapid Evidence Assessment (REA).

PICOC PROTOCOL:
- Population: ${picoc.population}
- Intervention: ${picoc.intervention}
- Comparison: ${picoc.comparison}
- Outcome: ${picoc.outcome}
- Context: ${picoc.context}

PRIMARY QUESTION: ${picoc.primaryQuestion || 'Does dog presence in workplaces improve employee well-being?'}

PAPER TO SCREEN:
Title: ${paper.title}
Abstract: ${paper.abstract || 'No abstract available'}
Year: ${paper.year}
Authors: ${(paper.authors || []).join(', ')}

Score this paper's relevance from 0-100 and provide a brief reason.
Return JSON with keys: score (0-100), reason (1-2 sentences), pico (object with keys P, I, C, O each true/false), recommendation ("include"|"exclude"|"unsure")`;

  return askJSON(prompt);
}

export async function extractData(paper) {
  await rateDelay();
  const prompt = `You are a research data extractor for a systematic review on pet dogs in workplaces and employee well-being.

Extract structured data from this paper:
Title: ${paper.title}
Abstract: ${paper.abstract || 'No abstract available'}
Year: ${paper.year}

Return JSON with these keys:
- study_design: "RCT"|"quasi-experimental"|"cross-sectional"|"longitudinal"|"mixed-methods"|"case-study"|"qualitative"|"other"
- sample_size: string (e.g. "N=75" or "unknown")
- workplace_setting: string (e.g. "office", "healthcare", "education", "multiple")
- dog_type: "employee-owned"|"therapy/visiting"|"both"|"unknown"
- intervention_duration: string (e.g. "single session", "4 weeks", "ongoing", "unknown")
- outcomes_measured: array of strings
- key_findings: string (2-3 sentences)
- comparison_group: "yes"|"no"|"unclear"
- population_description: string
- limitations: string`;

  return askJSON(prompt);
}

export async function prefilQuality(paper) {
  await rateDelay();
  const prompt = `You are a quality appraiser for a mixed-methods systematic review.

Assess study quality using these 8 criteria (yes/no/unclear for each):
1. Clear research question or objective
2. Study design appropriate for the question
3. Adequate sample size for conclusions drawn
4. Valid and reliable measurement of outcomes
5. Presence of a comparison group or baseline measurement
6. Potential confounders acknowledged or controlled
7. Findings clearly presented with sufficient detail
8. Conclusions supported by the data presented

Paper:
Title: ${paper.title}
Abstract: ${paper.abstract || 'No abstract available'}
Study design: ${paper.extractedData?.study_design || paper.extractedData?.studyDesign || 'unknown'}

Return JSON:
{
  "q1_clear_question": "yes"|"no"|"unclear",
  "q2_appropriate_design": "yes"|"no"|"unclear",
  "q3_adequate_sample": "yes"|"no"|"unclear",
  "q4_valid_measures": "yes"|"no"|"unclear",
  "q5_comparison_group": "yes"|"no"|"unclear",
  "q6_confounders": "yes"|"no"|"unclear",
  "q7_clear_findings": "yes"|"no"|"unclear",
  "q8_supported_conclusions": "yes"|"no"|"unclear",
  "overall_rating": "high"|"moderate"|"low",
  "quality_notes": "brief overall comment"
}`;

  return askJSON(prompt);
}

export async function generateSynthesis(papers, subQuestions, picoc) {
  const summaries = papers.slice(0, 15).map((p, i) =>
    `[${i + 1}] ${p.title} (${p.year}) — ${p.extractedData?.key_findings || p.extractedData?.keyFindings || p.abstract?.slice(0, 200) || 'No summary'}`
  ).join('\n');

  const prompt = `You are synthesising evidence for a Rapid Evidence Assessment on: Does dog presence in workplaces improve employee well-being?

INCLUDED STUDIES (${papers.length} total, showing first 15):
${summaries}

Write a structured narrative synthesis covering these themes:
1. Overview of evidence base (types of studies, settings, sample sizes)
2. Effects on stress
3. Effects on mood
4. Effects on job satisfaction
5. Other outcomes (productivity, burnout, absenteeism)
6. Consistency across workplace types
7. Negative effects or unintended consequences
8. Implications for HR practitioners
9. Limitations of the evidence base
10. Overall conclusion

Use academic language. Cite studies as [1], [2], etc. Reference the numbered list above.
Write approximately 800-1000 words in flowing paragraphs. Do NOT use JSON.`;

  await rateDelay();
  return ask(prompt);
}

export async function generateImplications(project, papers, extractions, appraisals, synthesisText) {
  await rateDelay();

  const highQuality = appraisals.filter(a => a.overall_rating === 'high' || a.overall || a.overall === 'high').length;
  const settings = [...new Set(extractions.map(e => e.workplace_setting || e.population).filter(Boolean))].slice(0, 6).join(', ');
  const synthSnippet = synthesisText ? synthesisText.slice(0, 800) : 'No synthesis available yet.';

  const prompt = `You are writing the "Practical Implications" section of a Rapid Evidence Assessment (REA) for Evidence-Based Management.

TOPIC: Pet dogs in the workplace and employee well-being
PRIMARY QUESTION: ${project.primaryQuestion || project.question || 'Does dog presence in workplaces improve employee well-being?'}
INCLUDED STUDIES: ${papers.length} papers
HIGH-QUALITY STUDIES: ${highQuality}
WORKPLACE SETTINGS COVERED: ${settings || 'varied'}
SYNTHESIS EXCERPT: ${synthSnippet}

Write a focused, practical "Implications for Practice" section (250-350 words) aimed at HR managers, business leaders, and organisational policy-makers. Structure it as follows:
1. What the evidence suggests practitioners should consider (2-3 concrete, evidence-grounded recommendations)
2. Conditions under which dog-friendly policies are most likely to benefit employees
3. What managers should be cautious about (e.g. allergies, phobias, disruption)
4. A brief statement on the strength of the evidence base and how confident practitioners should be

Use clear, professional language. Do not use bullet points — write in flowing paragraphs. Do NOT use JSON.`;

  return ask(prompt);
}

export async function generateLimitations(project, papers, synthesisText) {
  await rateDelay();

  const databases = (project.databases || ['PubMed', 'Semantic Scholar', 'OpenAlex']).join(', ');
  const dateRange = project.dateRange ? `${project.dateRange.from}–${project.dateRange.to}` : '2000–2026';
  const synthSnippet = synthesisText ? synthesisText.slice(0, 400) : '';

  const prompt = `You are writing the "Limitations" section of a Rapid Evidence Assessment (REA) for Evidence-Based Management.

TOPIC: Pet dogs in the workplace and employee well-being
DATABASES SEARCHED: ${databases}
DATE RANGE: ${dateRange}
NUMBER OF INCLUDED STUDIES: ${papers.length}
THIS IS A RAPID EVIDENCE ASSESSMENT (not a full systematic review)
${synthSnippet ? `SYNTHESIS CONTEXT: ${synthSnippet}` : ''}

Write a concise "Limitations of this REA" section (200-280 words) covering:
1. Scope limitations (databases searched, grey literature excluded, language restriction to English)
2. Methodological limitations of the REA process itself (speed vs rigour trade-off, potential for missed studies)
3. Limitations of the evidence base (small sample sizes in primary studies, heterogeneity, lack of RCTs, possible publication bias)
4. AI-assistance limitations (AI-assisted screening and extraction may introduce systematic errors; all outputs were reviewed by the researcher)
5. Generalisability (most studies from Western contexts, specific workplace types)

Write in flowing paragraphs, in clear academic English. Do not use bullet points or numbered lists. Do NOT use JSON.`;

  return ask(prompt);
}
