// Pre-loaded REA protocol for: Pet Dogs in Workplace Settings & Employee Well-being
export const SEED_PROTOCOL = {
  name: 'Pet Dogs in the Workplace & Employee Well-being',
  topic: 'dogs_workplace_wellbeing',
  status: 'in_progress',
  currentStep: 1,

  picoc: {
    population: 'Employees in various workplace settings (offices, corporate environments, healthcare, education, etc.)',
    intervention: 'Presence of pet dogs in the workplace (employee-owned or therapy/visiting animals)',
    comparison: 'Workplace with no dogs present, or a suitable control/comparison group or condition',
    outcome: 'Employee well-being: stress, mood, job satisfaction; also engagement, productivity, burnout',
    context: 'Real-world or simulated workplace environments, studies published 2000–2026'
  },

  primaryQuestion: 'For employees in various workplace settings (P), does the presence of any pet dogs — employee-owned or therapy (I) — compared to a no-dog environment (C) improve employee well-being, e.g. stress, mood, job satisfaction (O)?',

  subQuestions: [
    'What types of dog interventions have been studied in workplace settings (employee-owned vs. therapy vs. organisation-owned), and can their effects be distinguished?',
    'What workplace settings have been studied (offices, factories, healthcare, education, etc.)?',
    'What measures of employee well-being have been used (stress, mood, job satisfaction, etc.)?',
    'What are the effects of dog presence on perceived stress among employees?',
    'What are the effects of dog presence on employee mood?',
    'What are the effects of dog presence on employee job satisfaction?',
    'What are the effects of dog presence on other well-being outcomes (productivity, absenteeism, burnout)?',
    'What is the duration and frequency of dog interventions in included studies?',
    'Are the effects of dog presence consistent across different types of workplaces?',
    'Are there any reported negative effects or unintended consequences of having dogs in the workplace?',
    'How consistent are the findings across different workplace types and study designs?',
    'What are the key characteristics of included studies (sample size, demographics, study design, duration)?',
    'What does the overall body of evidence suggest for HR decision-makers and organisations considering pet-friendly workplace policies?',
    'What are the key strengths and limitations of the studies identified, and how do they affect confidence in the findings?'
  ],

  inclusionCriteria: [
    'Published between 2000 and 2026',
    'Published in English',
    'Quantitative, qualitative, or mixed-methods empirical studies (RCTs, quasi-experimental, cohort, cross-sectional, case-control)',
    'Studies that compare dog presence to a no-dog environment, or assess effects of dog presence on employee well-being',
    'Measures at least one outcome: stress, mood, job satisfaction, engagement, productivity, or burnout',
    'Population: employees in workplace settings (offices, corporate, healthcare, education, etc.)',
    'Intervention: presence of pet dogs (employee-owned or therapy/visiting)',
    'Comparison: workplace with no dogs present, or suitable control/comparison condition',
    'Conducted in real-world or simulated workplace environments'
  ],

  exclusionCriteria: [
    'Not conducted in workplace or organisational settings (unless healthcare staff well-being is measured)',
    'Studies involving animals other than dogs (cats, birds, rabbits, etc.)',
    'Studies involving only service animals or medical assistance animals',
    'Non-empirical studies (reviews, editorials, commentaries, opinion pieces)',
    'Does not measure any specified employee well-being outcomes',
    'No basis for assessing effect of dog presence (no comparison group, no baseline, no pre-post design)',
    'Published before 2000',
    'Not available in full text or not in English',
    'Focuses exclusively on children or non-employee populations (students, patients)',
    'Dog presence is incidental/unmeasured rather than a deliberate intervention or policy'
  ],

  searchStrings: {
    core: '(dog OR dogs OR "pet dog" OR "therapy dog" OR canine OR "animal-assisted") AND (workplace OR office OR "work environment" OR occupational OR employ*) AND ("well-being" OR wellbeing OR stress OR burnout OR "job satisfaction" OR mood OR anxiety)',
    pubmed: '((dog[tw] OR dogs[tw] OR "pet dog"[tw] OR "therapy dog"[tw] OR canine[tw]) AND (workplace[tw] OR office[tw] OR occupational[tw] OR employee[tw]) AND (wellbeing[tw] OR "well-being"[tw] OR stress[tw] OR burnout[tw] OR "job satisfaction"[tw] OR mood[tw]))',
    semanticScholar: 'pet dogs workplace employee wellbeing stress job satisfaction',
    openAlex: 'dogs workplace employee wellbeing stress burnout job satisfaction'
  },

  databases: ['PubMed', 'Semantic Scholar', 'OpenAlex'],
  dateRange: { from: 2000, to: 2026 },
  languages: ['English']
};
