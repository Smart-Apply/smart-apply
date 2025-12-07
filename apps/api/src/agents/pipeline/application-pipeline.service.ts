import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ATSKeywordAgent } from '../ats/ats-keyword.agent';
import { CVWriterAgent } from '../cv/cv-writer.agent';
import { CLWriterAgent } from '../cl/cl-writer.agent';
import {
  ATSAgentInput,
  ATSAgentOutput,
  CVAgentInput,
  CVAgentOutput,
  CLAgentInput,
  CLAgentOutput,
  ProfileData,
  PipelineStatus,
  PipelineResult,
} from '../agents.interface';

export interface ApplicationPipelineInput {
  userId: string;
  applicationId: string;
  jobPosting: {
    id: string;
    title: string;
    company: string;
    location?: string;
    language?: string;
    fullText: string; // Complete job posting text
  };
  profile: ProfileData;
  language: 'de' | 'en';
}

/**
 * Application Pipeline Service
 *
 * Orchestrates the full application generation workflow:
 * 1. ATS Agent extracts keywords from job posting
 * 2. CV Agent + CL Agent run in parallel with extracted keywords
 * 3. Results are combined and returned
 *
 * Emits status events for real-time progress tracking via SSE.
 */
@Injectable()
export class ApplicationPipelineService {
  private readonly logger = new Logger(ApplicationPipelineService.name);

  constructor(
    private readonly atsAgent: ATSKeywordAgent,
    private readonly cvAgent: CVWriterAgent,
    private readonly clAgent: CLWriterAgent,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Execute the full application generation pipeline
   */
  async execute(input: ApplicationPipelineInput): Promise<PipelineResult> {
    const { applicationId, jobPosting, profile, language } = input;
    const startTime = Date.now();

    this.logger.log(`Starting pipeline for application ${applicationId}`);

    try {
      // Stage 1: Extract keywords
      this.emitStatus(applicationId, {
        stage: 'extracting-keywords',
        progress: 10,
        message: 'Analyzing job posting and extracting keywords...',
        timestamp: new Date(),
      });

      const keywords = await this.executeWithTimeout(
        this.extractKeywords(jobPosting),
        60000, // 60 second timeout
        'Keyword extraction timed out',
      );

      this.logger.log(`Extracted ${this.countKeywords(keywords)} keywords`);

      // Stage 2: Generate CV and Cover Letter in parallel
      this.emitStatus(applicationId, {
        stage: 'generating-cv',
        progress: 40,
        message: 'Generating optimized resume and cover letter...',
        timestamp: new Date(),
      });

      const [cvResult, clResult] = await Promise.all([
        this.executeWithTimeout(
          this.generateCV(keywords, profile, jobPosting, language),
          90000, // 90 second timeout
          'CV generation timed out',
        ),
        this.executeWithTimeout(
          this.generateCoverLetter(keywords, profile, jobPosting, language),
          90000, // 90 second timeout
          'Cover letter generation timed out',
        ),
      ]);

      // Stage 3: Finalize and combine results
      this.emitStatus(applicationId, {
        stage: 'finalizing',
        progress: 90,
        message: 'Finalizing application documents...',
        timestamp: new Date(),
      });

      const matchAnalysis = this.calculateMatchAnalysis(keywords, cvResult, clResult);

      const result: PipelineResult = {
        keywords,
        cv: cvResult,
        coverLetter: clResult,
        matchAnalysis,
        generatedAt: new Date(),
      };

      // Complete
      this.emitStatus(applicationId, {
        stage: 'complete',
        progress: 100,
        message: 'Application documents generated successfully!',
        timestamp: new Date(),
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `Pipeline completed for application ${applicationId} in ${duration}ms. Match score: ${matchAnalysis.overallScore}%`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Pipeline failed for application ${applicationId}`, error);

      this.emitStatus(applicationId, {
        stage: 'failed',
        progress: 0,
        message: 'Failed to generate application documents',
        timestamp: new Date(),
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Extract keywords using ATS Agent
   */
  private async extractKeywords(
    jobPosting: ApplicationPipelineInput['jobPosting'],
  ): Promise<ATSAgentOutput> {
    const input: ATSAgentInput = {
      jobPosting: {
        title: jobPosting.title,
        company: jobPosting.company,
        location: jobPosting.location || null,
        fullText: jobPosting.fullText,
        language: jobPosting.language ? (jobPosting.language as 'de' | 'en') : this.detectLanguage(jobPosting.fullText),
      },
    };

    return this.atsAgent.execute(input);
  }

  /**
   * Generate CV using CV Agent
   */
  private async generateCV(
    keywords: ATSAgentOutput,
    profile: ProfileData,
    jobPosting: { title: string; company: string; fullText: string },
    language: 'de' | 'en',
  ): Promise<CVAgentOutput> {
    const input: CVAgentInput = {
      keywords,
      profile,
      jobPosting,
      language,
    };

    return this.cvAgent.execute(input);
  }

  /**
   * Generate Cover Letter using CL Agent
   */
  private async generateCoverLetter(
    keywords: ATSAgentOutput,
    profile: ProfileData,
    jobPosting: { title: string; company: string; fullText: string },
    language: 'de' | 'en',
  ): Promise<CLAgentOutput> {
    const input: CLAgentInput = {
      keywords,
      profile,
      jobPosting,
      language,
    };

    return this.clAgent.execute(input);
  }

  /**
   * Calculate comprehensive match analysis
   */
  private calculateMatchAnalysis(
    keywords: ATSAgentOutput,
    cv: CVAgentOutput,
    coverLetter: CLAgentOutput,
  ): PipelineResult['matchAnalysis'] {
    // Count total keywords by category
    const totalTechnical = keywords.coreCompetencies.length + keywords.methodologies.length;
    const totalSoft = keywords.softSkills.length;
    const totalExperience = keywords.senioritySignals.length + keywords.requirementKeywords.length;
    const totalIndustry = keywords.industryKeywords.length;

    // Count matched keywords from CV
    const matchedTechnical = cv.keywordMatches.filter(
      (k) => k.found && (k.category === 'core' || k.category === 'methodology'),
    ).length;
    const matchedSoft = cv.keywordMatches.filter((k) => k.found && k.category === 'soft').length;
    const matchedExperience = cv.keywordMatches.filter(
      (k) => k.found && (k.category === 'requirement' || k.category === 'seniority'),
    ).length;
    const matchedIndustry = cv.keywordMatches.filter(
      (k) => k.found && k.category === 'industry',
    ).length;

    // Calculate category scores
    const technicalScore =
      totalTechnical > 0 ? Math.round((matchedTechnical / totalTechnical) * 100) : 0;
    const softScore = totalSoft > 0 ? Math.round((matchedSoft / totalSoft) * 100) : 0;
    const experienceScore =
      totalExperience > 0 ? Math.round((matchedExperience / totalExperience) * 100) : 0;
    const industryScore =
      totalIndustry > 0 ? Math.round((matchedIndustry / totalIndustry) * 100) : 0;

    // Overall score (weighted average)
    const weights = { technical: 0.4, soft: 0.2, experience: 0.25, industry: 0.15 };
    const overallScore = Math.round(
      technicalScore * weights.technical +
        softScore * weights.soft +
        experienceScore * weights.experience +
        industryScore * weights.industry,
    );

    // Generate suggestions
    const suggestions: string[] = [];
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (technicalScore >= 70) {
      strengths.push('Gute Übereinstimmung bei Kernkompetenzen');
    } else if (technicalScore < 50) {
      const missingTech = keywords.coreCompetencies
        .filter((k) => !cv.keywordMatches.some((m) => m.keyword === k && m.found))
        .slice(0, 3);
      if (missingTech.length > 0) {
        suggestions.push(`Relevante Qualifikationen könnten ergänzt werden: ${missingTech.join(', ')}`);
        weaknesses.push('Einige Kernkompetenzen nicht gefunden');
      }
    }

    if (softScore >= 70) {
      strengths.push('Soft Skills gut repräsentiert');
    } else if (softScore < 50 && totalSoft > 0) {
      suggestions.push('Ggf. könnten mehr Soft Skills in der Berufserfahrung hervorgehoben werden');
      weaknesses.push('Soft Skills könnten stärker betont werden');
    }

    if (cv.matchScore >= 75) {
      strengths.push('Profil passt gut zur Stellenausschreibung');
    }

    if (coverLetter.keyHighlights.length >= 3) {
      strengths.push('Anschreiben hebt Qualifikationen gut hervor');
    }

    return {
      overallScore,
      categoryScores: {
        technical: technicalScore,
        soft: softScore,
        experience: experienceScore,
        industry: industryScore,
      },
      suggestions: suggestions.slice(0, 5),
      strengths: strengths.slice(0, 3),
      weaknesses: weaknesses.slice(0, 3),
    };
  }

  /**
   * Execute a promise with timeout
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string,
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(errorMessage)), timeoutMs),
      ),
    ]);
  }

  /**
   * Emit pipeline status event
   */
  private emitStatus(applicationId: string, status: PipelineStatus): void {
    this.eventEmitter.emit('application.pipeline.status', {
      applicationId,
      status,
    });
  }

  /**
   * Count total keywords
   */
  private countKeywords(keywords: ATSAgentOutput): number {
    return (
      keywords.coreCompetencies.length +
      keywords.softSkills.length +
      keywords.responsibilityKeywords.length +
      keywords.requirementKeywords.length +
      keywords.methodologies.length +
      keywords.industryKeywords.length +
      keywords.senioritySignals.length +
      keywords.miscKeywords.length
    );
  }

  /**
   * Detect language from text with improved accuracy
   */
  private detectLanguage(text: string): 'de' | 'en' | null {
    const lowerText = text.toLowerCase();
    
    // Expanded German indicators (very common German words/patterns)
    const germanIndicators = [
      'und', 'oder', 'für', 'mit', 'bei', 'wir', 'ihre', 'ihr', 'den', 'der', 'die', 'das',
      'eine', 'einen', 'einem', 'einer', 'deine', 'deinen', 'deiner', 'unsere', 'unseren',
      'sie', 'sind', 'haben', 'können', 'werden', 'möchten', 'sollten', 'dich', 'dein',
      'entwicklung', 'erfahrung', 'kenntnisse', 'aufgaben', 'verantwortung',
      'deutsch', 'englisch', 'umfeld', 'zusammenarbeit', 'über', 'nach'
    ];
    
    // Expanded English indicators (MORE common words - heavily weighted)
    const englishIndicators = [
      'the', 'and', 'or', 'for', 'with', 'at', 'in', 'on', 'of', 'to', 'from', 'by', 'as',
      'we', 'you', 'your', 'our', 'their', 'them', 'they',
      'are', 'is', 'will', 'have', 'has', 'had', 'can', 'would', 'should', 'must',
      'this', 'that', 'these', 'those', 'who', 'what', 'where', 'when', 'how', 'why',
      'development', 'experience', 'knowledge', 'responsibilities', 'tasks',
      'skills', 'requirements', 'team', 'work', 'build', 'design', 'implement',
      'role', 'position', 'company', 'looking', 'join', 'apply', 'about', 'mission',
      'proven', 'strong', 'familiarity', 'understanding', 'fluency', 'collaborative'
    ];

    let germanScore = 0;
    let englishScore = 0;

    // Count occurrences (with word boundaries)
    for (const word of germanIndicators) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) germanScore += matches.length;
    }
    
    for (const word of englishIndicators) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) englishScore += matches.length;
    }

    this.logger.log(`🌍 Language detection: German score=${germanScore}, English score=${englishScore}`);

    // Require significant difference (at least 50% more) - higher threshold
    const threshold = 1.5;
    if (germanScore > englishScore * threshold) {
      this.logger.log('🇩🇪 Detected language: GERMAN');
      return 'de';
    }
    if (englishScore > germanScore * threshold) {
      this.logger.log('🇬🇧 Detected language: ENGLISH');
      return 'en';
    }
    
    // Default to English if scores are too close
    this.logger.log('🇬🇧 Language unclear, defaulting to: ENGLISH');
    return 'en';
  }
}
