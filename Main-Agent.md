# Main Agent Profile: REA Automation System

## Identity
**Name:** REA Automation Agent  
**Role:** Parent orchestrator for automated Rapid Evidence Assessment (REA) workflows  
**Domain:** Evidence-Based Management (EBMgt)  
**Version:** 1.0.0

## Purpose
This agent automates the complete REA process from problem scoping to final report generation. It coordinates multiple sub-systems (literature search APIs, AI analysis, human review interfaces) to produce timely, rigorous evidence syntheses for management decision-making.

## Workflow Architecture (12 Stages)

| Phase | Stage | Name | Automation | Human Role |
|-------|-------|------|-----------|------------|
| **Ask** | 1 | Background | Pre-filled from user input | Review and edit research context |
| **Ask** | 2 | Question & Sub-questions | Pre-filled PICOC + 14 sub-questions | Edit primary question and PICOC |
| **Acquire** | 3 | Inclusion Criteria | Pre-filled from protocol | Confirm inclusion/exclusion criteria |
| **Acquire** | 4 | Search Strategy | Pre-filled Boolean + DB-specific strings | Edit strings, set date range, run search |
| **Acquire** | 5 | Study Selection | AI relevance scoring (0–100%) | Include / Exclude / Unsure per paper |
| **Acquire** | 6 | Data Extraction | AI extracts 8 PICOC-aligned fields | Verify/edit extracted fields |
| **Appraise** | 7 | Critical Appraisal | AI pre-fills 8-criterion MMAT checklist | Rate each criterion, set overall quality |
| **Aggregate** | 8 | Results | Auto-generates evidence summary tables | Review study characteristic overview |
| **Aggregate** | 9 | Synthesis | AI generates ~800-word narrative | Review and edit thematic synthesis |
| **Aggregate** | 10 | Conclusion | — | Write overall conclusion from evidence |
| **Aggregate** | 11 | Limitations | Pre-filled common REA limitations | Review and edit, set confidence level |
| **Apply** | 12 | Implications & Recommendations | Auto-generates HTML/PDF report | Write practitioner recommendations, export |

## Connected APIs & Services

### Academic Databases (Free)
- **Semantic Scholar Graph API** — Full-text search, AI TLDRs, citation counts, multidisciplinary
- **OpenAlex API** — Global open catalog, 250M+ works, fully open, no key required
- **PubMed E-utilities** — NCBI biomedical database, useful for HR/organisational health studies

### AI Services
- **Google Gemini 2.5 Flash** — PICOC parsing, relevance scoring, data extraction, narrative synthesis (free tier: 1,500 req/day)

### Storage
- **SQLite (local)** — All project data, paper metadata, screening decisions, extracted data, quality scores persisted locally

## Technology Stack
- **Backend:** Node.js + Express (REST API)
- **Database:** SQLite via better-sqlite3
- **Frontend:** Vanilla JS SPA (no build step)
- **Design:** Dark glassmorphism UI with animated progress tracking
- **Export:** HTML report (print-to-PDF via browser)

## Quality Appraisal Framework (EBMgt-Adapted)
Six-criterion checklist adapted from CASP for management research:
1. Research design appropriateness
2. Sampling strategy justification
3. Data collection adequacy
4. Analysis rigour
5. Clarity of findings
6. Management applicability / transferability

Overall quality rating: **High / Medium / Low** — informs synthesis weighting.

## Key Design Principles
1. **Human-in-the-loop** — All critical decisions (screening, appraisal, synthesis approval) require human review
2. **Progressive disclosure** — Users advance stage-by-stage; earlier stages gate later ones
3. **Graceful degradation** — All AI features are optional; full manual workflow available without Gemini key
4. **Transparency** — All search strings, inclusion decisions, and methods are logged and exported
5. **Speed** — Targets completion in hours to days (vs. weeks for full systematic review)

## Running the System
```bash
cd rea-app
npm install
node server.js
# Open http://localhost:3000
```

## First-Time Setup
1. Paste Gemini API key in Settings (sidebar → Settings)
2. Click **Test Connection** to verify
3. Create a new REA project and follow the 12-stage wizard
