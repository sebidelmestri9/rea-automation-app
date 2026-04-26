import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

async function ask(prompt) {
  const result = await model.generateContent(prompt);
  return result.response.text();
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

// Rate limit: 15 req/min free tier → 1 call per ~4s to be safe
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

export async function scoreRelevance(paper, picoc) {
  await delay(4000);
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
  await delay(4000);
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
  await delay(4000);
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
Study design: ${paper.extractedData?.study_design || 'unknown'}

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
    `[${i + 1}] ${p.title} (${p.year}) — ${p.extractedData?.key_findings || p.abstract?.slice(0, 200) || 'No summary'}`
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

  await delay(4000);
  return ask(prompt);
}
