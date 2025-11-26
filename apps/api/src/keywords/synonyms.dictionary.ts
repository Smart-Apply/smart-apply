/**
 * Keyword synonym dictionary for ATS matching.
 * Maps canonical keyword names to their common variations.
 */

// Technical skills synonyms - programming languages, frameworks, tools
export const TECHNICAL_SYNONYMS: Record<string, string[]> = {
  // Programming Languages
  javascript: ['js', 'ecmascript', 'es6', 'es5', 'vanilla js', 'vanilla javascript'],
  typescript: ['ts', 'tsc'],
  python: ['py', 'python3', 'python2'],
  java: ['jdk', 'jre', 'j2ee', 'java ee', 'jakarta ee'],
  'c++': ['cpp', 'c plus plus', 'cplusplus'],
  'c#': ['csharp', 'c sharp', 'dotnet', '.net'],
  golang: ['go', 'go lang'],
  ruby: ['rb'],
  php: ['php7', 'php8'],
  rust: ['rs'],
  kotlin: ['kt'],
  swift: [],
  scala: [],
  r: ['rlang', 'r language'],

  // Frontend Frameworks
  react: ['reactjs', 'react.js', 'react js'],
  angular: ['angularjs', 'angular.js', 'angular 2+', 'ng'],
  vue: ['vuejs', 'vue.js', 'vue 3', 'vue 2'],
  svelte: ['sveltejs', 'sveltekit'],
  nextjs: ['next.js', 'next js', 'next'],
  nuxt: ['nuxtjs', 'nuxt.js'],
  gatsby: ['gatsbyjs'],

  // Backend Frameworks
  nodejs: ['node.js', 'node', 'node js'],
  express: ['expressjs', 'express.js'],
  nestjs: ['nest.js', 'nest'],
  spring: ['spring boot', 'springboot', 'spring framework'],
  django: [],
  flask: [],
  fastapi: ['fast api', 'fast-api'],
  rails: ['ruby on rails', 'ror'],
  laravel: [],
  'asp.net': ['asp.net core', 'aspnet', 'asp net'],

  // Databases
  postgresql: ['postgres', 'psql', 'pg'],
  mysql: ['mariadb'],
  mongodb: ['mongo', 'nosql'],
  redis: ['redis cache'],
  elasticsearch: ['elastic', 'es', 'elk'],
  dynamodb: ['dynamo', 'dynamodb'],
  cassandra: ['apache cassandra'],
  sqlite: ['sqlite3'],
  oracle: ['oracle db', 'oracle database'],
  'sql server': ['mssql', 'ms sql', 'microsoft sql'],

  // Cloud & DevOps
  aws: ['amazon web services', 'amazon aws'],
  azure: ['microsoft azure', 'ms azure'],
  gcp: ['google cloud', 'google cloud platform'],
  docker: ['containers', 'containerization'],
  kubernetes: ['k8s', 'k-8-s', 'kube'],
  terraform: ['tf', 'infrastructure as code', 'iac'],
  ansible: [],
  jenkins: ['jenkins ci', 'ci/cd'],
  'github actions': ['gh actions'],
  gitlab: ['gitlab ci', 'gitlab-ci'],
  circleci: ['circle ci'],

  // Tools & Platforms
  git: ['github', 'gitlab', 'bitbucket', 'version control'],
  jira: ['atlassian jira'],
  confluence: [],
  slack: [],
  figma: [],
  'vs code': ['vscode', 'visual studio code'],

  // API & Architecture
  rest: ['restful', 'rest api', 'restful api'],
  graphql: ['gql'],
  grpc: [],
  websocket: ['websockets', 'ws'],
  microservices: ['micro services', 'micro-services'],
  serverless: ['lambda', 'aws lambda', 'azure functions'],

  // Testing
  jest: [],
  mocha: [],
  cypress: [],
  playwright: [],
  selenium: ['webdriver'],
  pytest: [],
  junit: [],

  // Data & ML
  'machine learning': ['ml', 'ai'],
  'artificial intelligence': ['ai'],
  tensorflow: ['tf'],
  pytorch: ['torch'],
  pandas: [],
  numpy: [],
  'data science': ['data analytics', 'data analysis'],
  'big data': [],
  spark: ['apache spark'],
  hadoop: [],
};

// Soft skills synonyms
export const SOFT_SKILL_SYNONYMS: Record<string, string[]> = {
  communication: ['communicator', 'communicative', 'verbal skills', 'written skills'],
  leadership: ['leader', 'leading', 'team lead', 'management'],
  teamwork: ['team player', 'collaborative', 'collaboration', 'team-oriented'],
  'problem solving': ['problem-solving', 'analytical', 'critical thinking', 'troubleshooting'],
  'time management': ['deadline-driven', 'punctual', 'organized'],
  adaptability: ['flexible', 'adaptable', 'versatile'],
  creativity: ['creative', 'innovative', 'innovation'],
  'attention to detail': ['detail-oriented', 'meticulous', 'thorough'],
  'self-motivated': ['self-starter', 'proactive', 'initiative'],
  mentoring: ['coaching', 'training', 'teaching'],
};

// Experience level keywords
export const EXPERIENCE_SYNONYMS: Record<string, string[]> = {
  junior: ['entry level', 'entry-level', 'graduate', 'fresh graduate', 'beginner'],
  mid: ['mid-level', 'intermediate', '2-5 years', '3-5 years'],
  senior: ['sr.', 'sr', 'experienced', '5+ years', 'lead'],
  principal: ['staff', 'staff engineer', 'architect'],
  manager: ['engineering manager', 'team lead', 'tech lead'],
  director: ['head of', 'vp', 'vice president'],
};

// Industry keywords
export const INDUSTRY_SYNONYMS: Record<string, string[]> = {
  fintech: ['financial technology', 'finance tech', 'banking tech'],
  healthtech: ['health technology', 'healthcare tech', 'medtech'],
  ecommerce: ['e-commerce', 'online retail', 'retail tech'],
  edtech: ['education technology', 'ed-tech'],
  saas: ['software as a service', 'cloud software'],
  gdpr: ['data protection', 'privacy compliance', 'dsgvo'],
  hipaa: ['healthcare compliance', 'health data security'],
  'pci-dss': ['pci dss', 'payment card security', 'pci compliance'],
  soc2: ['soc 2', 'soc-2', 'security compliance'],
  iso27001: ['iso 27001', 'information security'],
};

// Methodology keywords
export const METHODOLOGY_SYNONYMS: Record<string, string[]> = {
  agile: ['scrum', 'kanban', 'lean', 'agile methodology'],
  scrum: ['scrum master', 'sprint'],
  kanban: ['kanban board'],
  devops: ['dev ops', 'devsecops'],
  'ci/cd': ['cicd', 'continuous integration', 'continuous deployment', 'continuous delivery'],
  tdd: ['test driven development', 'test-driven development'],
  bdd: ['behavior driven development', 'behavior-driven development'],
  pair: ['pair programming', 'mob programming'],
};

// Education keywords
export const EDUCATION_SYNONYMS: Record<string, string[]> = {
  bachelor: ['bs', 'ba', 'bsc', 'b.s.', 'b.a.', 'undergraduate', 'bachelors'],
  master: ['ms', 'ma', 'msc', 'm.s.', 'm.a.', 'masters', 'graduate'],
  phd: ['ph.d.', 'doctorate', 'doctoral'],
  'computer science': ['cs', 'comp sci', 'informatik'],
  engineering: ['eng', 'engineering degree'],
};

// Certification keywords
export const CERTIFICATION_SYNONYMS: Record<string, string[]> = {
  'aws certified': ['aws certification', 'aws solutions architect', 'aws developer'],
  'azure certified': ['azure certification', 'azure fundamentals', 'azure developer'],
  'gcp certified': ['google cloud certified', 'gcp certification'],
  'scrum master': ['csm', 'certified scrum master', 'psm'],
  pmp: ['project management professional', 'pmi pmp'],
  'kubernetes certified': ['cka', 'ckad', 'certified kubernetes'],
};

/**
 * Get all synonyms including category mappings
 */
export function getAllSynonyms(): Record<string, string[]> {
  return {
    ...TECHNICAL_SYNONYMS,
    ...SOFT_SKILL_SYNONYMS,
    ...EXPERIENCE_SYNONYMS,
    ...INDUSTRY_SYNONYMS,
    ...METHODOLOGY_SYNONYMS,
    ...EDUCATION_SYNONYMS,
    ...CERTIFICATION_SYNONYMS,
  };
}

/**
 * Build reverse lookup map from synonym to canonical keyword
 */
export function buildReverseLookup(): Map<string, string> {
  const lookup = new Map<string, string>();
  const allSynonyms = getAllSynonyms();

  for (const [canonical, synonyms] of Object.entries(allSynonyms)) {
    lookup.set(canonical.toLowerCase(), canonical);
    for (const synonym of synonyms) {
      lookup.set(synonym.toLowerCase(), canonical);
    }
  }

  return lookup;
}

/**
 * Get category for a keyword
 */
export function getKeywordCategory(
  keyword: string,
): 'technical' | 'soft' | 'experience' | 'industry' | 'methodology' | 'education' | 'certification' | null {
  const lowerKeyword = keyword.toLowerCase();

  if (lowerKeyword in TECHNICAL_SYNONYMS || Object.values(TECHNICAL_SYNONYMS).flat().includes(lowerKeyword)) {
    return 'technical';
  }
  if (lowerKeyword in SOFT_SKILL_SYNONYMS || Object.values(SOFT_SKILL_SYNONYMS).flat().includes(lowerKeyword)) {
    return 'soft';
  }
  if (lowerKeyword in EXPERIENCE_SYNONYMS || Object.values(EXPERIENCE_SYNONYMS).flat().includes(lowerKeyword)) {
    return 'experience';
  }
  if (lowerKeyword in INDUSTRY_SYNONYMS || Object.values(INDUSTRY_SYNONYMS).flat().includes(lowerKeyword)) {
    return 'industry';
  }
  if (lowerKeyword in METHODOLOGY_SYNONYMS || Object.values(METHODOLOGY_SYNONYMS).flat().includes(lowerKeyword)) {
    return 'methodology';
  }
  if (lowerKeyword in EDUCATION_SYNONYMS || Object.values(EDUCATION_SYNONYMS).flat().includes(lowerKeyword)) {
    return 'education';
  }
  if (lowerKeyword in CERTIFICATION_SYNONYMS || Object.values(CERTIFICATION_SYNONYMS).flat().includes(lowerKeyword)) {
    return 'certification';
  }

  return null;
}
