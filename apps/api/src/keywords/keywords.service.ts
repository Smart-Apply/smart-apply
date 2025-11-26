import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  getAllSynonyms,
  buildReverseLookup,
  getKeywordCategory,
  TECHNICAL_SYNONYMS,
  SOFT_SKILL_SYNONYMS,
  EXPERIENCE_SYNONYMS,
  INDUSTRY_SYNONYMS,
  METHODOLOGY_SYNONYMS,
  EDUCATION_SYNONYMS,
  CERTIFICATION_SYNONYMS,
} from './synonyms.dictionary';
import { KeywordMatchDto, MatchAnalysisResponseDto, ExtractedKeywordsDto } from './dto';

interface ProfileData {
  skills: { name: string; level?: string }[];
  experiences: { title: string; company: string; description?: string }[];
  education: { degree: string; institution: string; fieldOfStudy?: string }[];
  certificates: { name: string; issuer: string }[];
  projects: { name: string; description?: string; technologies: string[] }[];
  languages: { name: string; level: string }[];
  summary?: string;
}

interface JobPostingData {
  title: string;
  company: string;
  description?: string;
  requirements: string[];
  responsibilities: string[];
  niceToHave: string[];
  rawText?: string;
}

@Injectable()
export class KeywordsService {
  private readonly logger = new Logger(KeywordsService.name);
  private readonly reverseLookup: Map<string, string>;
  private readonly allSynonyms: Record<string, string[]>;
  // Pre-compiled regex cache for performance
  private readonly regexCache: Map<string, RegExp>;

  constructor(private readonly prisma: PrismaService) {
    this.reverseLookup = buildReverseLookup();
    this.allSynonyms = getAllSynonyms();
    this.regexCache = this.precompileRegexPatterns();
  }

  /**
   * Pre-compile regex patterns for all keywords and their synonyms
   */
  private precompileRegexPatterns(): Map<string, RegExp> {
    const cache = new Map<string, RegExp>();
    for (const [canonical, synonyms] of Object.entries(this.allSynonyms)) {
      const allVariations = [canonical, ...synonyms];
      for (const variation of allVariations) {
        const escaped = variation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        cache.set(variation.toLowerCase(), new RegExp(`\\b${escaped}\\b`, 'gi'));
      }
    }
    return cache;
  }

  /**
   * Extract keywords from job posting text
   */
  extractKeywords(jobPosting: JobPostingData): ExtractedKeywordsDto {
    const text = this.buildJobPostingText(jobPosting);
    const words = this.tokenize(text);

    const result: ExtractedKeywordsDto = {
      technical: [],
      soft: [],
      experience: [],
      industry: [],
      methodology: [],
      education: [],
      certifications: [],
    };

    // Track which canonical keywords we've already found
    const foundKeywords = new Set<string>();

    // Check for multi-word phrases first (more specific matches)
    for (const [canonical, synonyms] of Object.entries(this.allSynonyms)) {
      const allVariations = [canonical, ...synonyms];

      for (const variation of allVariations) {
        if (text.toLowerCase().includes(variation.toLowerCase())) {
          if (!foundKeywords.has(canonical)) {
            foundKeywords.add(canonical);
            this.addKeywordToCategory(result, canonical);
          }
          break;
        }
      }
    }

    // Also check individual words
    for (const word of words) {
      const canonical = this.reverseLookup.get(word.toLowerCase());
      if (canonical && !foundKeywords.has(canonical)) {
        foundKeywords.add(canonical);
        this.addKeywordToCategory(result, canonical);
      }
    }

    // Extract years of experience patterns
    const yearsPattern = /(\d+)\+?\s*(?:years?|yrs?)/gi;
    let match;
    while ((match = yearsPattern.exec(text)) !== null) {
      const years = parseInt(match[1], 10);
      const experienceLevel = this.yearsToLevel(years);
      if (experienceLevel && !result.experience.includes(experienceLevel)) {
        result.experience.push(experienceLevel);
      }
    }

    this.logger.log(
      `Extracted keywords: ${Object.values(result).flat().length} total`,
    );

    return result;
  }

  /**
   * Analyze how well a profile matches a job posting
   */
  async analyzeMatch(
    userId: string,
    jobPostingId: string,
  ): Promise<MatchAnalysisResponseDto> {
    // Fetch profile
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
        skills: true,
        experiences: true,
        education: true,
        certificates: true,
        projects: true,
        languages: true,
      },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    // Fetch job posting
    const jobPosting = await this.prisma.jobPosting.findUnique({
      where: { id: jobPostingId },
    });

    if (!jobPosting) {
      throw new NotFoundException('Job posting not found');
    }

    return this.performAnalysis(
      this.mapProfileToData(profile),
      this.mapJobPostingToData(jobPosting),
    );
  }

  /**
   * Map Prisma profile entity to ProfileData interface
   */
  private mapProfileToData(profile: {
    skills: { name: string; level?: string | null }[];
    experiences: { title: string; company: string; description?: string | null }[];
    education: { degree: string; institution: string; fieldOfStudy?: string | null }[];
    certificates: { name: string; issuer: string }[];
    projects: { name: string; description?: string | null; technologies: string[] }[];
    languages: { name: string; level: string }[];
    summary?: string | null;
  }): ProfileData {
    return {
      skills: profile.skills.map((s) => ({ name: s.name, level: s.level ?? undefined })),
      experiences: profile.experiences.map((e) => ({
        title: e.title,
        company: e.company,
        description: e.description ?? undefined,
      })),
      education: profile.education.map((e) => ({
        degree: e.degree,
        institution: e.institution,
        fieldOfStudy: e.fieldOfStudy ?? undefined,
      })),
      certificates: profile.certificates.map((c) => ({ name: c.name, issuer: c.issuer })),
      projects: profile.projects.map((p) => ({
        name: p.name,
        description: p.description ?? undefined,
        technologies: p.technologies,
      })),
      languages: profile.languages.map((l) => ({ name: l.name, level: l.level })),
      summary: profile.summary ?? undefined,
    };
  }

  /**
   * Map Prisma job posting entity to JobPostingData interface
   */
  private mapJobPostingToData(jobPosting: {
    title: string;
    company: string;
    description?: string | null;
    requirements: string[];
    responsibilities: string[];
    niceToHave: string[];
    rawText?: string | null;
  }): JobPostingData {
    return {
      title: jobPosting.title,
      company: jobPosting.company,
      description: jobPosting.description ?? undefined,
      requirements: jobPosting.requirements,
      responsibilities: jobPosting.responsibilities,
      niceToHave: jobPosting.niceToHave,
      rawText: jobPosting.rawText ?? undefined,
    };
  }

  /**
   * Perform the actual match analysis
   */
  performAnalysis(
    profile: ProfileData,
    jobPosting: JobPostingData,
  ): MatchAnalysisResponseDto {
    // Extract keywords from job posting
    const extractedKeywords = this.extractKeywords(jobPosting);
    const allJobKeywords = this.flattenExtractedKeywords(extractedKeywords);

    // Build profile keyword set
    const profileKeywords = this.extractProfileKeywords(profile);

    // Perform matching
    const matchedKeywords: KeywordMatchDto[] = [];
    const missingKeywords: KeywordMatchDto[] = [];

    const categoryStats = {
      technical: { matched: 0, total: 0 },
      soft: { matched: 0, total: 0 },
      experience: { matched: 0, total: 0 },
      other: { matched: 0, total: 0 },
    };

    for (const keyword of allJobKeywords) {
      const category = getKeywordCategory(keyword);
      const categoryKey = this.mapToMainCategory(category);
      categoryStats[categoryKey].total++;

      const matchResult = this.findKeywordInProfile(keyword, profileKeywords);

      if (matchResult.found) {
        categoryStats[categoryKey].matched++;
        matchedKeywords.push({
          keyword,
          category: category || 'technical',
          found: true,
          confidence: matchResult.confidence,
          locations: matchResult.locations,
          frequency: this.countKeywordFrequency(keyword, jobPosting),
        });
      } else {
        missingKeywords.push({
          keyword,
          category: category || 'technical',
          found: false,
          confidence: 0,
          frequency: this.countKeywordFrequency(keyword, jobPosting),
        });
      }
    }

    // Calculate overall match percentage
    const matchPercentage = this.calculateMatchPercentage(
      matchedKeywords.length,
      allJobKeywords.length,
    );

    // Generate insights
    const suggestions = this.generateSuggestions(missingKeywords, categoryStats);
    const strengths = this.identifyStrengths(matchedKeywords);
    const weaknesses = this.identifyWeaknesses(missingKeywords, categoryStats);

    // Calculate category breakdown
    const categoryBreakdown = {
      technical: this.calculateCategoryPercentage(categoryStats.technical),
      soft: this.calculateCategoryPercentage(categoryStats.soft),
      experience: this.calculateCategoryPercentage(categoryStats.experience),
      other: this.calculateCategoryPercentage(categoryStats.other),
    };

    this.logger.log(
      `Match analysis complete: ${matchPercentage}% (${matchedKeywords.length}/${allJobKeywords.length} keywords)`,
    );

    return {
      matchPercentage,
      matchedKeywords: matchedKeywords.sort((a, b) => b.confidence - a.confidence),
      missingKeywords: missingKeywords.sort((a, b) => (b.frequency || 0) - (a.frequency || 0)),
      suggestions,
      strengths,
      weaknesses,
      categoryBreakdown,
    };
  }

  /**
   * Build complete text from job posting for analysis
   */
  private buildJobPostingText(jobPosting: JobPostingData): string {
    const parts = [
      jobPosting.title,
      jobPosting.company,
      jobPosting.description,
      ...(jobPosting.requirements || []),
      ...(jobPosting.responsibilities || []),
      ...(jobPosting.niceToHave || []),
      jobPosting.rawText,
    ];

    return parts.filter(Boolean).join(' ');
  }

  /**
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s\-\.\+#]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 1);
  }

  /**
   * Add keyword to appropriate category
   */
  private addKeywordToCategory(result: ExtractedKeywordsDto, keyword: string): void {
    const lowerKeyword = keyword.toLowerCase();

    if (lowerKeyword in TECHNICAL_SYNONYMS) {
      result.technical.push(keyword);
    } else if (lowerKeyword in SOFT_SKILL_SYNONYMS) {
      result.soft.push(keyword);
    } else if (lowerKeyword in EXPERIENCE_SYNONYMS) {
      result.experience.push(keyword);
    } else if (lowerKeyword in INDUSTRY_SYNONYMS) {
      result.industry.push(keyword);
    } else if (lowerKeyword in METHODOLOGY_SYNONYMS) {
      result.methodology.push(keyword);
    } else if (lowerKeyword in EDUCATION_SYNONYMS) {
      result.education.push(keyword);
    } else if (lowerKeyword in CERTIFICATION_SYNONYMS) {
      result.certifications.push(keyword);
    } else {
      // Default to technical for unknown keywords
      result.technical.push(keyword);
    }
  }

  /**
   * Convert years of experience to level
   */
  private yearsToLevel(years: number): string | null {
    if (years <= 2) return 'junior';
    if (years <= 5) return 'mid';
    if (years <= 8) return 'senior';
    return 'principal';
  }

  /**
   * Flatten extracted keywords into a single array
   */
  private flattenExtractedKeywords(extracted: ExtractedKeywordsDto): string[] {
    return [
      ...extracted.technical,
      ...extracted.soft,
      ...extracted.experience,
      ...extracted.industry,
      ...extracted.methodology,
      ...extracted.education,
      ...extracted.certifications,
    ];
  }

  /**
   * Extract all keywords from profile
   */
  private extractProfileKeywords(profile: ProfileData): Map<string, string[]> {
    const keywords = new Map<string, string[]>();

    // Skills
    for (const skill of profile.skills || []) {
      const canonical = this.getCanonicalKeyword(skill.name);
      if (canonical) {
        this.addToKeywordMap(keywords, canonical, 'skills');
      }
    }

    // Experience titles and descriptions
    for (const exp of profile.experiences || []) {
      const titleKeywords = this.tokenize(exp.title);
      for (const word of titleKeywords) {
        const canonical = this.getCanonicalKeyword(word);
        if (canonical) {
          this.addToKeywordMap(keywords, canonical, 'experience.title');
        }
      }

      if (exp.description) {
        const descKeywords = this.tokenize(exp.description);
        for (const word of descKeywords) {
          const canonical = this.getCanonicalKeyword(word);
          if (canonical) {
            this.addToKeywordMap(keywords, canonical, 'experience.description');
          }
        }
      }
    }

    // Education
    for (const edu of profile.education || []) {
      const eduText = `${edu.degree} ${edu.institution} ${edu.fieldOfStudy || ''}`;
      const eduKeywords = this.tokenize(eduText);
      for (const word of eduKeywords) {
        const canonical = this.getCanonicalKeyword(word);
        if (canonical) {
          this.addToKeywordMap(keywords, canonical, 'education');
        }
      }
    }

    // Certificates
    for (const cert of profile.certificates || []) {
      const certText = `${cert.name} ${cert.issuer}`;
      const certKeywords = this.tokenize(certText);
      for (const word of certKeywords) {
        const canonical = this.getCanonicalKeyword(word);
        if (canonical) {
          this.addToKeywordMap(keywords, canonical, 'certificates');
        }
      }
    }

    // Projects and technologies
    for (const proj of profile.projects || []) {
      for (const tech of proj.technologies || []) {
        const canonical = this.getCanonicalKeyword(tech);
        if (canonical) {
          this.addToKeywordMap(keywords, canonical, 'projects.technologies');
        }
      }

      if (proj.description) {
        const descKeywords = this.tokenize(proj.description);
        for (const word of descKeywords) {
          const canonical = this.getCanonicalKeyword(word);
          if (canonical) {
            this.addToKeywordMap(keywords, canonical, 'projects.description');
          }
        }
      }
    }

    // Summary
    if (profile.summary) {
      const summaryKeywords = this.tokenize(profile.summary);
      for (const word of summaryKeywords) {
        const canonical = this.getCanonicalKeyword(word);
        if (canonical) {
          this.addToKeywordMap(keywords, canonical, 'summary');
        }
      }
    }

    return keywords;
  }

  /**
   * Get canonical keyword from any variation
   */
  private getCanonicalKeyword(word: string): string | null {
    const lower = word.toLowerCase();

    // Check if it's a canonical keyword
    if (lower in this.allSynonyms) {
      return lower;
    }

    // Check reverse lookup
    const canonical = this.reverseLookup.get(lower);
    return canonical || null;
  }

  /**
   * Add keyword to map with location
   */
  private addToKeywordMap(
    map: Map<string, string[]>,
    keyword: string,
    location: string,
  ): void {
    const existing = map.get(keyword) || [];
    if (!existing.includes(location)) {
      existing.push(location);
    }
    map.set(keyword, existing);
  }

  /**
   * Find keyword in profile with confidence scoring
   */
  private findKeywordInProfile(
    keyword: string,
    profileKeywords: Map<string, string[]>,
  ): { found: boolean; confidence: number; locations: string[] } {
    const canonical = this.getCanonicalKeyword(keyword) || keyword.toLowerCase();

    if (profileKeywords.has(canonical)) {
      const locations = profileKeywords.get(canonical) || [];
      const confidence = this.calculateConfidence(locations);
      return { found: true, confidence, locations };
    }

    // Check if the raw keyword exists as a substring in any profile keyword
    for (const [profileKeyword, locations] of profileKeywords) {
      if (
        profileKeyword.includes(canonical) ||
        canonical.includes(profileKeyword)
      ) {
        return { found: true, confidence: 0.7, locations };
      }
    }

    return { found: false, confidence: 0, locations: [] };
  }

  /**
   * Calculate confidence based on where keyword was found
   */
  private calculateConfidence(locations: string[]): number {
    let confidence = 0;

    for (const location of locations) {
      if (location === 'skills') {
        confidence = Math.max(confidence, 1.0);
      } else if (location.startsWith('experience')) {
        confidence = Math.max(confidence, 0.9);
      } else if (location.startsWith('projects.technologies')) {
        confidence = Math.max(confidence, 0.85);
      } else if (location === 'education') {
        confidence = Math.max(confidence, 0.8);
      } else if (location === 'certificates') {
        confidence = Math.max(confidence, 0.85);
      } else if (location === 'summary') {
        confidence = Math.max(confidence, 0.7);
      } else {
        confidence = Math.max(confidence, 0.6);
      }
    }

    return confidence;
  }

  /**
   * Count how often a keyword appears in job posting
   * Uses pre-compiled regex patterns for performance
   */
  private countKeywordFrequency(keyword: string, jobPosting: JobPostingData): number {
    const text = this.buildJobPostingText(jobPosting).toLowerCase();
    const canonical = keyword.toLowerCase();
    const synonyms = this.allSynonyms[canonical] || [];
    const allVariations = [canonical, ...synonyms];

    let count = 0;
    for (const variation of allVariations) {
      const cachedRegex = this.regexCache.get(variation.toLowerCase());
      if (cachedRegex) {
        // Reset lastIndex for global regex
        cachedRegex.lastIndex = 0;
        const matches = text.match(cachedRegex);
        count += matches ? matches.length : 0;
      } else {
        // Fallback for uncached patterns
        const escaped = this.escapeRegex(variation);
        const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
        const matches = text.match(regex);
        count += matches ? matches.length : 0;
      }
    }

    return count;
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Map category to main category for statistics
   */
  private mapToMainCategory(
    category: string | null,
  ): 'technical' | 'soft' | 'experience' | 'other' {
    if (!category) return 'other';
    if (category === 'technical') return 'technical';
    if (category === 'soft') return 'soft';
    if (category === 'experience') return 'experience';
    return 'other';
  }

  /**
   * Calculate match percentage from matched and total counts
   */
  private calculateMatchPercentage(matchedCount: number, totalCount: number): number {
    if (totalCount === 0) return 0;
    return Math.round((matchedCount / totalCount) * 100);
  }

  /**
   * Calculate category percentage with matched and total counts
   */
  private calculateCategoryPercentage(stats: { matched: number; total: number }): {
    matched: number;
    total: number;
    percentage: number;
  } {
    return {
      matched: stats.matched,
      total: stats.total,
      percentage: this.calculateMatchPercentage(stats.matched, stats.total),
    };
  }

  /**
   * Generate improvement suggestions based on missing keywords
   */
  private generateSuggestions(
    missingKeywords: KeywordMatchDto[],
    categoryStats: Record<string, { matched: number; total: number }>,
  ): string[] {
    const suggestions: string[] = [];

    // Technical skill suggestions
    const missingTechnical = missingKeywords
      .filter((k) => k.category === 'technical')
      .slice(0, 3);
    if (missingTechnical.length > 0) {
      const skills = missingTechnical.map((k) => `'${k.keyword}'`).join(', ');
      suggestions.push(`Add ${skills} to your skills if you have experience with them`);
    }

    // Low category match suggestions
    if (categoryStats.technical.total > 0 && categoryStats.technical.matched / categoryStats.technical.total < 0.5) {
      suggestions.push('Consider highlighting more technical skills in your profile');
    }

    if (categoryStats.soft.total > 0 && categoryStats.soft.matched / categoryStats.soft.total < 0.5) {
      suggestions.push('Add more soft skills to your profile summary or experience descriptions');
    }

    // Certification suggestions
    const missingCerts = missingKeywords.filter((k) => k.category === 'certification');
    if (missingCerts.length > 0) {
      suggestions.push(`Consider obtaining certifications like ${missingCerts[0].keyword}`);
    }

    // Experience level suggestions
    const missingExp = missingKeywords.filter((k) => k.category === 'experience');
    if (missingExp.length > 0) {
      suggestions.push('Ensure your experience level is clearly stated in your summary');
    }

    return suggestions.slice(0, 5);
  }

  /**
   * Identify profile strengths
   */
  private identifyStrengths(matchedKeywords: KeywordMatchDto[]): string[] {
    const strengths: string[] = [];

    // Strong technical match
    const technicalMatches = matchedKeywords.filter((k) => k.category === 'technical');
    if (technicalMatches.length >= 3) {
      const topSkills = technicalMatches.slice(0, 3).map((k) => k.keyword).join(', ');
      strengths.push(`Strong technical match for ${topSkills}`);
    }

    // Experience match
    const expMatches = matchedKeywords.filter((k) => k.category === 'experience');
    if (expMatches.length > 0) {
      strengths.push('Experience level aligns with job requirements');
    }

    // High confidence matches
    const highConfidence = matchedKeywords.filter((k) => k.confidence >= 0.9);
    if (highConfidence.length >= 2) {
      strengths.push('Multiple keywords found in relevant sections');
    }

    return strengths.slice(0, 3);
  }

  /**
   * Identify profile weaknesses
   */
  private identifyWeaknesses(
    missingKeywords: KeywordMatchDto[],
    categoryStats: Record<string, { matched: number; total: number }>,
  ): string[] {
    const weaknesses: string[] = [];

    // Critical missing technical skills
    const criticalMissing = missingKeywords
      .filter((k) => k.category === 'technical' && (k.frequency || 0) >= 2);
    if (criticalMissing.length > 0) {
      const skills = criticalMissing.slice(0, 2).map((k) => k.keyword).join(', ');
      weaknesses.push(`Missing frequently mentioned skills: ${skills}`);
    }

    // Low category coverage
    if (categoryStats.technical.total > 0 && categoryStats.technical.matched === 0) {
      weaknesses.push('No technical skill matches found');
    }

    // Missing certifications
    const missingCerts = missingKeywords.filter((k) => k.category === 'certification');
    if (missingCerts.length > 0) {
      weaknesses.push('Missing required or preferred certifications');
    }

    return weaknesses.slice(0, 3);
  }
}
