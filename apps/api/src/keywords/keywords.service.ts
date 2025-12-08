import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ATSAgentOutput, ProfileData } from '../agents/agents.interface';
import { KeywordMatchDto, MatchAnalysisResponseDto, ExtractedKeywordsDto } from './dto';
import { LLMService } from '../llm/llm.service';

interface JobPostingData {
  title: string;
  company: string;
  location?: string;
  language?: string;
  fullText: string;
  rawText?: string;
}

@Injectable()
export class KeywordsService {
  private readonly logger = new Logger(KeywordsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmService: LLMService,
  ) {}

  /**
   * Extract keywords from job posting using LLM
   */
  async extractKeywords(jobPosting: JobPostingData): Promise<ATSAgentOutput> {
    this.logger.log(`Extracting keywords for: ${jobPosting.title} at ${jobPosting.company}`);

    const language =
      (jobPosting.language as 'de' | 'en') || this.detectLanguage(jobPosting.fullText);

    // Use LLM to extract keywords
    const keywords = await this.llmService.callJson<ATSAgentOutput>('v1/ats-keywords-extract.md', {
      jobTitle: jobPosting.title,
      company: jobPosting.company,
      location: jobPosting.location || '',
      fullText: jobPosting.fullText,
      language,
    });

    // Ensure all required arrays exist (defensive programming)
    const normalizedKeywords: ATSAgentOutput = {
      coreCompetencies: keywords.coreCompetencies || [],
      softSkills: keywords.softSkills || [],
      responsibilityKeywords: keywords.responsibilityKeywords || [],
      requirementKeywords: keywords.requirementKeywords || [],
      methodologies: keywords.methodologies || [],
      industryKeywords: keywords.industryKeywords || [],
      senioritySignals: keywords.senioritySignals || [],
      miscKeywords: keywords.miscKeywords || [],
    };

    this.logger.log(`Extracted ${this.countKeywords(normalizedKeywords)} keywords`);
    return normalizedKeywords;
  }

  /**
   * Extract keywords from profile using LLM (pre-extraction for caching)
   * Returns AtsKeywordsOutputDto format for direct storage in profileKeywords field
   */
  async extractAndCacheProfileKeywords(profile: ProfileData): Promise<any> {
    this.logger.log(
      `Extracting keywords from profile for: ${profile.firstName} ${profile.lastName}`,
    );

    try {
      // Use LLM to extract keywords from profile data
      const keywords = await this.llmService.callJson<any>('v1/profile-keywords.md', {
        profile: {
          summary: profile.summary,
          skills: profile.skills,
          experiences: profile.experiences?.map((exp) => ({
            title: exp.title,
            company: exp.company,
            description: exp.description,
            startDate: exp.startDate,
            endDate: exp.endDate,
          })),
          education: profile.education?.map((edu) => ({
            degree: edu.degree,
            institution: edu.institution,
            fieldOfStudy: edu.fieldOfStudy,
          })),
          certificates: profile.certificates?.map((cert) => ({
            name: cert.name,
            issuer: cert.issuer,
          })),
          projects: profile.projects?.map((proj) => ({
            name: proj.name,
            description: proj.description,
            technologies: proj.technologies,
          })),
          languages: profile.languages,
        },
      });

      // Ensure all required arrays exist and mark as 'profile' source
      const normalizedKeywords = {
        hard_skills: (keywords.hard_skills || []).map((k: any) => ({
          ...k,
          source: 'profile',
        })),
        tools_and_tech: (keywords.tools_and_tech || []).map((k: any) => ({
          ...k,
          source: 'profile',
        })),
        domains: (keywords.domains || []).map((k: any) => ({
          ...k,
          source: 'profile',
        })),
        methodologies: (keywords.methodologies || []).map((k: any) => ({
          ...k,
          source: 'profile',
        })),
      };

      const totalKeywords =
        (normalizedKeywords.hard_skills?.length || 0) +
        (normalizedKeywords.tools_and_tech?.length || 0) +
        (normalizedKeywords.domains?.length || 0) +
        (normalizedKeywords.methodologies?.length || 0);

      this.logger.log(`Extracted ${totalKeywords} profile keywords`);
      return normalizedKeywords;
    } catch (error) {
      this.logger.error(`Failed to extract profile keywords: ${error.message}`, error.stack);
      // Return empty keywords on failure
      return {
        hard_skills: [],
        tools_and_tech: [],
        domains: [],
        methodologies: [],
      };
    }
  }

  /**
   * Convert ATSAgentOutput to legacy ExtractedKeywordsDto format
   * For backwards compatibility with existing code
   */
  convertToLegacyFormat(keywords: ATSAgentOutput): ExtractedKeywordsDto {
    return {
      core: [...keywords.coreCompetencies, ...keywords.methodologies],
      soft: keywords.softSkills,
      experience: keywords.senioritySignals,
      industry: keywords.industryKeywords,
      methodology: [], // Not directly mapped in new format
      education: keywords.requirementKeywords.filter((k) =>
        /degree|bachelor|master|phd|diploma|university|college/i.test(k),
      ),
      certifications: keywords.requirementKeywords.filter((k) =>
        /certified|certification|certificate|license/i.test(k),
      ),
    };
  }

  /**
   * Analyze how well a profile matches a job posting
   */
  async analyzeMatch(userId: string, jobPostingId: string): Promise<MatchAnalysisResponseDto> {
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

    // Extract keywords using ATS Agent (simplified with fullText)
    const keywords = await this.extractKeywords({
      title: jobPosting.title,
      company: jobPosting.company,
      location: jobPosting.location || undefined,
      language: jobPosting.language || undefined,
      fullText: jobPosting.fullText,
      rawText: jobPosting.rawText || undefined,
    });

    // Perform matching analysis
    return this.performAnalysis(this.mapProfileToData(profile), keywords);
  }

  /**
   * Perform the actual match analysis between profile and extracted keywords
   */
  performAnalysis(profile: ProfileData, keywords: ATSAgentOutput): MatchAnalysisResponseDto {
    const allKeywords = this.flattenKeywords(keywords);
    const profileKeywords = this.extractProfileKeywords(profile);

    const matchedKeywords: KeywordMatchDto[] = [];
    const missingKeywords: KeywordMatchDto[] = [];

    const categoryStats = {
      core: { matched: 0, total: 0 },
      soft: { matched: 0, total: 0 },
      experience: { matched: 0, total: 0 },
      other: { matched: 0, total: 0 },
    };

    // Analyze each keyword
    for (const { keyword, category } of allKeywords) {
      const mainCategory = this.mapToMainCategory(category);
      categoryStats[mainCategory].total++;

      const matchResult = this.findKeywordInProfile(keyword, profileKeywords);

      if (matchResult.found) {
        categoryStats[mainCategory].matched++;
        matchedKeywords.push({
          keyword,
          category: this.mapToLegacyCategory(category),
          found: true,
          confidence: matchResult.confidence,
          locations: matchResult.locations,
          frequency: 1,
        });
      } else {
        missingKeywords.push({
          keyword,
          category: this.mapToLegacyCategory(category),
          found: false,
          confidence: 0,
          frequency: 1,
        });
      }
    }

    // Calculate weighted match percentage based on category importance
    // Weights: Hard Skills (40%), Soft Skills (20%), Experience (30%), Other (10%)
    const matchPercentage = this.calculateWeightedScore(categoryStats);

    // Calculate simple match percentage for comparison/logging
    const totalKeywords = allKeywords.length;
    const simpleMatchPercentage =
      totalKeywords > 0 ? Math.round((matchedKeywords.length / totalKeywords) * 100) : 0;

    // Generate insights
    const suggestions = this.generateSuggestions(missingKeywords, categoryStats);
    const strengths = this.identifyStrengths(matchedKeywords);
    const weaknesses = this.identifyWeaknesses(missingKeywords, categoryStats);

    this.logger.log(
      `Match analysis complete: ${matchPercentage}% weighted (${simpleMatchPercentage}% simple, ${matchedKeywords.length}/${totalKeywords} keywords)`,
    );

    return {
      matchPercentage,
      matchedKeywords: matchedKeywords.sort((a, b) => b.confidence - a.confidence),
      missingKeywords: missingKeywords.sort((a, b) => (b.frequency || 0) - (a.frequency || 0)),
      suggestions,
      strengths,
      weaknesses,
      categoryBreakdown: {
        core: this.calculateCategoryPercentage(categoryStats.core),
        soft: this.calculateCategoryPercentage(categoryStats.soft),
        experience: this.calculateCategoryPercentage(categoryStats.experience),
        other: this.calculateCategoryPercentage(categoryStats.other),
      },
    };
  }

  /**
   * Detect language from job posting full text
   */
  private detectLanguage(text: string): 'de' | 'en' | null {
    const lowercase = text.toLowerCase();

    // Simple heuristic: check for common German words
    const germanWords = ['und', 'oder', 'für', 'mit', 'von', 'bei', 'wir', 'sie', 'ihre', 'unser'];
    const englishWords = ['and', 'or', 'for', 'with', 'from', 'at', 'we', 'you', 'your', 'our'];

    let germanScore = 0;
    let englishScore = 0;

    for (const word of germanWords) {
      if (lowercase.includes(` ${word} `)) germanScore++;
    }
    for (const word of englishWords) {
      if (lowercase.includes(` ${word} `)) englishScore++;
    }

    if (germanScore > englishScore) return 'de';
    if (englishScore > germanScore) return 'en';
    return null;
  }

  /**
   * Count total keywords (with defensive checks for undefined arrays)
   */
  private countKeywords(keywords: ATSAgentOutput): number {
    return (
      (keywords.coreCompetencies?.length || 0) +
      (keywords.softSkills?.length || 0) +
      (keywords.responsibilityKeywords?.length || 0) +
      (keywords.requirementKeywords?.length || 0) +
      (keywords.methodologies?.length || 0) +
      (keywords.industryKeywords?.length || 0) +
      (keywords.senioritySignals?.length || 0) +
      (keywords.miscKeywords?.length || 0)
    );
  }

  /**
   * Flatten keywords with category information (with defensive checks for undefined arrays)
   */
  private flattenKeywords(keywords: ATSAgentOutput): { keyword: string; category: string }[] {
    return [
      ...(keywords.coreCompetencies || []).map((k) => ({ keyword: k, category: 'core' })),
      ...(keywords.softSkills || []).map((k) => ({ keyword: k, category: 'soft' })),
      ...(keywords.responsibilityKeywords || []).map((k) => ({
        keyword: k,
        category: 'responsibility',
      })),
      ...(keywords.requirementKeywords || []).map((k) => ({ keyword: k, category: 'requirement' })),
      ...(keywords.methodologies || []).map((k) => ({ keyword: k, category: 'methodology' })),
      ...(keywords.industryKeywords || []).map((k) => ({ keyword: k, category: 'industry' })),
      ...(keywords.senioritySignals || []).map((k) => ({ keyword: k, category: 'seniority' })),
      ...(keywords.miscKeywords || []).map((k) => ({ keyword: k, category: 'misc' })),
    ];
  }

  /**
   * Map profile to ProfileData interface
   */
  private mapProfileToData(profile: any): ProfileData {
    return {
      firstName: profile.user?.firstName || '',
      lastName: profile.user?.lastName || '',
      email: profile.user?.email || '',
      phone: profile.phone || undefined,
      summary: profile.summary || undefined,
      skills: profile.skills.map((s: any) => ({
        id: s.id,
        name: s.name,
        level: s.level || undefined,
      })),
      experiences: profile.experiences.map((e: any) => ({
        id: e.id,
        title: e.title,
        company: e.company,
        location: e.location || undefined,
        startDate: e.startDate,
        endDate: e.endDate || undefined,
        current: e.current,
        description: e.description || undefined,
      })),
      education: profile.education.map((e: any) => ({
        id: e.id,
        degree: e.degree,
        institution: e.institution,
        fieldOfStudy: e.fieldOfStudy || undefined,
        startDate: e.startDate || undefined,
        endDate: e.endDate || undefined,
      })),
      certificates: profile.certificates.map((c: any) => ({
        id: c.id,
        name: c.name,
        issuer: c.issuer,
        issueDate: c.issueDate || undefined,
        expiryDate: c.expiryDate || undefined,
      })),
      projects: profile.projects.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description || undefined,
        url: p.url || undefined,
        technologies: p.technologies || [],
      })),
      languages: profile.languages.map((l: any) => ({
        id: l.id,
        name: l.name,
        level: l.level,
      })),
    };
  }

  /**
   * Extract keywords from profile for matching
   */
  private extractProfileKeywords(profile: ProfileData): Map<string, string[]> {
    const keywords = new Map<string, string[]>();

    // Skills
    for (const skill of profile.skills || []) {
      this.addToKeywordMap(keywords, skill.name.toLowerCase(), 'skills');
    }

    // Experience titles and descriptions
    for (const exp of profile.experiences || []) {
      const words = this.tokenize(exp.title);
      for (const word of words) {
        this.addToKeywordMap(keywords, word, 'experience.title');
      }
      if (exp.description) {
        const descWords = this.tokenize(exp.description);
        for (const word of descWords) {
          this.addToKeywordMap(keywords, word, 'experience.description');
        }
      }
    }

    // Education
    for (const edu of profile.education || []) {
      const eduText = `${edu.degree} ${edu.institution} ${edu.fieldOfStudy || ''}`;
      const words = this.tokenize(eduText);
      for (const word of words) {
        this.addToKeywordMap(keywords, word, 'education');
      }
    }

    // Certificates
    for (const cert of profile.certificates || []) {
      const certText = `${cert.name} ${cert.issuer}`;
      const words = this.tokenize(certText);
      for (const word of words) {
        this.addToKeywordMap(keywords, word, 'certificates');
      }
    }

    // Projects and technologies
    for (const proj of profile.projects || []) {
      for (const tech of proj.technologies || []) {
        this.addToKeywordMap(keywords, tech.toLowerCase(), 'projects.technologies');
      }
      if (proj.description) {
        const words = this.tokenize(proj.description);
        for (const word of words) {
          this.addToKeywordMap(keywords, word, 'projects.description');
        }
      }
    }

    // Summary
    if (profile.summary) {
      const words = this.tokenize(profile.summary);
      for (const word of words) {
        this.addToKeywordMap(keywords, word, 'summary');
      }
    }

    return keywords;
  }

  /**
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s\-\.\+#]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2);
  }

  /**
   * Add keyword to map with location
   */
  private addToKeywordMap(map: Map<string, string[]>, keyword: string, location: string): void {
    const normalized = keyword.toLowerCase().trim();
    if (!normalized) return;

    const existing = map.get(normalized) || [];
    if (!existing.includes(location)) {
      existing.push(location);
    }
    map.set(normalized, existing);
  }

  /**
   * Find keyword in profile with fuzzy matching
   */
  private findKeywordInProfile(
    keyword: string,
    profileKeywords: Map<string, string[]>,
  ): { found: boolean; confidence: number; locations: string[] } {
    const normalizedKeyword = keyword.toLowerCase().trim();

    // Exact match
    if (profileKeywords.has(normalizedKeyword)) {
      const locations = profileKeywords.get(normalizedKeyword) || [];
      return { found: true, confidence: this.calculateConfidence(locations), locations };
    }

    // Partial match (keyword contains or is contained in profile keyword)
    for (const [profileKeyword, locations] of profileKeywords) {
      if (
        profileKeyword.includes(normalizedKeyword) ||
        normalizedKeyword.includes(profileKeyword)
      ) {
        return { found: true, confidence: 0.7, locations };
      }
    }

    // No match found
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
      } else if (location === 'certificates') {
        confidence = Math.max(confidence, 0.85);
      } else if (location === 'education') {
        confidence = Math.max(confidence, 0.8);
      } else if (location === 'summary') {
        confidence = Math.max(confidence, 0.7);
      } else {
        confidence = Math.max(confidence, 0.6);
      }
    }
    return confidence;
  }

  /**
   * Map category to main category for statistics
   */
  private mapToMainCategory(category: string): 'core' | 'soft' | 'experience' | 'other' {
    switch (category) {
      case 'core':
      case 'methodology':
        return 'core';
      case 'soft':
        return 'soft';
      case 'seniority':
      case 'requirement':
        return 'experience';
      default:
        return 'other';
    }
  }

  /**
   * Map to legacy category for DTO compatibility
   */
  private mapToLegacyCategory(
    category: string,
  ): 'core' | 'soft' | 'experience' | 'industry' | 'methodology' | 'education' | 'certification' {
    switch (category) {
      case 'core':
      case 'methodology':
        return 'core';
      case 'soft':
        return 'soft';
      case 'seniority':
        return 'experience';
      case 'industry':
        return 'industry';
      case 'requirement':
        return 'education';
      default:
        return 'core';
    }
  }

  /**
   * Calculate category percentage
   */
  private calculateCategoryPercentage(stats: { matched: number; total: number }): {
    matched: number;
    total: number;
    percentage: number;
  } {
    return {
      matched: stats.matched,
      total: stats.total,
      percentage: stats.total > 0 ? Math.round((stats.matched / stats.total) * 100) : 0,
    };
  }

  /**
   * Calculate weighted match percentage based on category importance
   * Weights: Core Competencies (40%), Soft Skills (20%), Experience (30%), Other/Certificates (10%)
   */
  private calculateWeightedScore(
    categoryStats: Record<string, { matched: number; total: number }>,
  ): number {
    const weights = {
      core: 0.4, // Core Competencies - 40%
      soft: 0.2, // Soft Skills - 20%
      experience: 0.3, // Experience - 30%
      other: 0.1, // Certificates, Education, etc. - 10%
    };

    let weightedScore = 0;
    let totalWeight = 0;

    // Calculate weighted score for each category
    for (const [category, stats] of Object.entries(categoryStats)) {
      const weight = weights[category] || 0;
      const categoryScore = stats.total > 0 ? stats.matched / stats.total : 0;

      weightedScore += categoryScore * weight;
      totalWeight += stats.total > 0 ? weight : 0;
    }

    // Normalize score to 0-100
    // If no categories have keywords, return 0
    if (totalWeight === 0) return 0;

    // Adjust score based on actual weight coverage
    const finalScore = (weightedScore / totalWeight) * 100;

    return Math.round(finalScore);
  }

  /**
   * Generate improvement suggestions (German, soft recommendations)
   */
  private generateSuggestions(
    missingKeywords: KeywordMatchDto[],
    categoryStats: Record<string, { matched: number; total: number }>,
  ): string[] {
    const suggestions: string[] = [];

    // Core competency suggestions
    const missingCore = missingKeywords.filter((k) => k.category === 'core').slice(0, 3);
    if (missingCore.length > 0) {
      const skills = missingCore.map((k) => k.keyword).join(', ');
      suggestions.push(`Relevante Kompetenzen könnten ergänzt werden: ${skills}`);
    }

    // Low category match suggestions
    if (
      categoryStats.core.total > 0 &&
      categoryStats.core.matched / categoryStats.core.total < 0.5
    ) {
      suggestions.push('Eventuell könnten weitere Fachkompetenzen im Profil hervorgehoben werden');
    }

    if (
      categoryStats.soft.total > 0 &&
      categoryStats.soft.matched / categoryStats.soft.total < 0.5
    ) {
      suggestions.push(
        'Ggf. könnten mehr Soft Skills in der Zusammenfassung oder Berufserfahrung genannt werden',
      );
    }

    if (
      categoryStats.experience.total > 0 &&
      categoryStats.experience.matched / categoryStats.experience.total < 0.3
    ) {
      suggestions.push('Die Berufserfahrung könnte detaillierter beschrieben werden');
    }

    return suggestions.slice(0, 5);
  }

  /**
   * Identify profile strengths (German)
   */
  private identifyStrengths(matchedKeywords: KeywordMatchDto[]): string[] {
    const strengths: string[] = [];

    const coreMatches = matchedKeywords.filter((k) => k.category === 'core');
    if (coreMatches.length >= 3) {
      const topSkills = coreMatches
        .slice(0, 3)
        .map((k) => k.keyword)
        .join(', ');
      strengths.push(`Gute Übereinstimmung bei: ${topSkills}`);
    }

    const expMatches = matchedKeywords.filter((k) => k.category === 'experience');
    if (expMatches.length > 0) {
      strengths.push('Berufserfahrung entspricht den Anforderungen');
    }

    const highConfidence = matchedKeywords.filter((k) => k.confidence >= 0.9);
    if (highConfidence.length >= 2) {
      strengths.push('Mehrere Keywords in relevanten Abschnitten gefunden');
    }

    const softMatches = matchedKeywords.filter((k) => k.category === 'soft');
    if (softMatches.length >= 2) {
      strengths.push('Soft Skills gut repräsentiert');
    }

    return strengths.slice(0, 3);
  }

  /**
   * Identify profile weaknesses (German, soft language)
   */
  private identifyWeaknesses(
    missingKeywords: KeywordMatchDto[],
    categoryStats: Record<string, { matched: number; total: number }>,
  ): string[] {
    const weaknesses: string[] = [];

    const criticalMissing = missingKeywords.filter(
      (k) => k.category === 'core' && (k.frequency || 0) >= 2,
    );
    if (criticalMissing.length > 0) {
      const skills = criticalMissing
        .slice(0, 2)
        .map((k) => k.keyword)
        .join(', ');
      weaknesses.push(`Häufig genannte Qualifikationen nicht gefunden: ${skills}`);
    }

    if (categoryStats.core.total > 0 && categoryStats.core.matched === 0) {
      weaknesses.push('Keine Übereinstimmung bei Kernkompetenzen');
    }

    if (categoryStats.soft.total > 0 && categoryStats.soft.matched === 0) {
      weaknesses.push('Soft Skills könnten stärker betont werden');
    }

    return weaknesses.slice(0, 3);
  }
}
