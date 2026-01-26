import { Injectable, Logger } from '@nestjs/common';
import { LLMService } from '../../llm/llm.service';
import {
  InterviewSession,
  InterviewQuestion,
  InterviewType,
  InterviewDifficulty,
} from '../../generated/prisma/client';

/**
 * Context for generating session feedback
 */
export interface FeedbackGenerationContext {
  session: InterviewSession & { questions: InterviewQuestion[] };
  profileSummary?: string;
}

/**
 * Category scores for feedback
 */
export interface CategoryScores {
  technicalScore?: number;
  communicationScore: number;
  presentationScore: number;
  problemSolvingScore?: number;
  cultureFitScore?: number;
}

/**
 * Generated session feedback
 */
export interface SessionFeedback {
  overallScore: number;
  categoryScores: CategoryScores;
  strengths: string[];
  improvements: string[];
  recommendations: string[];
  idealAnswers?: Record<string, string>;
  summaryFeedback: string;
}

/**
 * LLM response structure for feedback generation
 */
interface FeedbackLLMResponse {
  overallScore: number;
  categoryScores: {
    technicalScore?: number;
    communicationScore: number;
    presentationScore: number;
    problemSolvingScore?: number;
    cultureFitScore?: number;
  };
  strengths: string[];
  improvements: string[];
  recommendations: string[];
  idealAnswers?: Record<string, string>;
  summaryFeedback: string;
}

@Injectable()
export class InterviewFeedbackGeneratorService {
  private readonly logger = new Logger(InterviewFeedbackGeneratorService.name);

  constructor(private readonly llmService: LLMService) {}

  /**
   * Generate comprehensive feedback for a completed interview session
   */
  async generateFeedback(context: FeedbackGenerationContext): Promise<SessionFeedback> {
    const { session } = context;

    this.logger.log(`Generating feedback for session ${session.id}`);

    // Calculate session duration
    const startTime = new Date(session.startedAt).getTime();
    const endTime = session.completedAt ? new Date(session.completedAt).getTime() : Date.now();
    const sessionDuration = Math.round((endTime - startTime) / 60000); // minutes

    // Build questions and answers summary
    const questionsAndAnswers = session.questions
      .sort((a, b) => a.order - b.order)
      .map(
        (q) => `
**Frage ${q.order}:** ${q.questionText}
**Antwort:** ${q.userAnswer || 'Keine Antwort'}
**Dauer:** ${q.answerDuration ? `${q.answerDuration} Sekunden` : 'Nicht gemessen'}
`,
      )
      .join('\n---\n');

    // Build individual scores summary
    const individualScores = session.questions
      .filter((q) => q.score !== null)
      .map((q) => `Frage ${q.order}: ${q.score}/100`)
      .join('\n');

    // Calculate average score for validation
    const answeredQuestions = session.questions.filter((q) => q.score !== null);
    const avgScore =
      answeredQuestions.length > 0
        ? Math.round(
            answeredQuestions.reduce((sum, q) => sum + (q.score || 0), 0) /
              answeredQuestions.length,
          )
        : 50;

    const promptContext = {
      jobTitle: session.jobTitle || 'Unbekannte Position',
      company: session.company || 'Unbekanntes Unternehmen',
      industry: session.industry || 'Allgemein',
      interviewType: this.getInterviewTypeLabel(session.type),
      difficulty: this.getDifficultyLabel(session.difficulty),
      language: session.language === 'de' ? 'Deutsch' : 'English',
      sessionDuration: sessionDuration.toString(),
      profileSummary: context.profileSummary || 'Keine Profilinformationen verfügbar',
      questionsAndAnswers,
      individualScores: individualScores || 'Keine Einzelbewertungen verfügbar',
    };

    try {
      const response = await this.llmService.callJson<FeedbackLLMResponse>(
        'interview-feedback.md',
        promptContext,
        {
          temperature: 0.6,
          maxTokens: 1200,
        },
      );

      // Validate and normalize response
      const overallScore = Math.min(100, Math.max(1, Number(response.overallScore) || 50));

      // Build category scores based on interview type
      const categoryScores: CategoryScores = {
        communicationScore: Math.min(
          100,
          Math.max(1, Number(response.categoryScores?.communicationScore) || 50),
        ),
        presentationScore: Math.min(
          100,
          Math.max(1, Number(response.categoryScores?.presentationScore) || 50),
        ),
      };

      // Add technical score for technical interviews
      if (session.type === InterviewType.TECHNICAL || session.type === InterviewType.MIXED) {
        categoryScores.technicalScore = Math.min(
          100,
          Math.max(1, Number(response.categoryScores?.technicalScore) || 50),
        );
      }

      // Add problem solving for case studies
      if (session.type === InterviewType.CASE_STUDY || session.type === InterviewType.MIXED) {
        categoryScores.problemSolvingScore = Math.min(
          100,
          Math.max(1, Number(response.categoryScores?.problemSolvingScore) || 50),
        );
      }

      // Culture fit is optional
      if (response.categoryScores?.cultureFitScore !== undefined) {
        categoryScores.cultureFitScore = Math.min(
          100,
          Math.max(1, Number(response.categoryScores.cultureFitScore)),
        );
      }

      const result: SessionFeedback = {
        overallScore,
        categoryScores,
        strengths: response.strengths || [],
        improvements: response.improvements || [],
        recommendations: response.recommendations || [],
        idealAnswers: response.idealAnswers,
        summaryFeedback: response.summaryFeedback || 'Danke für Ihre Teilnahme am Interview.',
      };

      // Validate overall score is reasonable
      if (Math.abs(result.overallScore - avgScore) > 20) {
        this.logger.warn(
          `Generated overall score ${result.overallScore} differs significantly from average ${avgScore}`,
        );
      }

      this.logger.debug(`Generated feedback with overall score: ${result.overallScore}`);

      return result;
    } catch (error: any) {
      this.logger.error(`Failed to generate feedback: ${error.message}`);

      // Return a calculated fallback feedback
      return this.calculateFallbackFeedback(session, avgScore);
    }
  }

  /**
   * Get human-readable interview type label
   */
  private getInterviewTypeLabel(type: InterviewType): string {
    const labels: Record<InterviewType, string> = {
      BEHAVIORAL: 'Verhaltensbezogen',
      TECHNICAL: 'Technisch/Fachlich',
      CASE_STUDY: 'Fallstudie',
      MIXED: 'Gemischt',
    };
    return labels[type] || type;
  }

  /**
   * Get human-readable difficulty label
   */
  private getDifficultyLabel(difficulty: InterviewDifficulty): string {
    const labels: Record<InterviewDifficulty, string> = {
      EASY: 'Einsteiger',
      MEDIUM: 'Standard',
      HARD: 'Experten',
    };
    return labels[difficulty] || difficulty;
  }

  /**
   * Calculate fallback feedback based on question scores
   */
  private calculateFallbackFeedback(
    session: InterviewSession & { questions: InterviewQuestion[] },
    avgScore: number,
  ): SessionFeedback {
    const isGerman = session.language === 'de';

    return {
      overallScore: avgScore,
      categoryScores: {
        communicationScore: avgScore,
        presentationScore: avgScore,
        technicalScore:
          session.type === InterviewType.TECHNICAL || session.type === InterviewType.MIXED
            ? avgScore
            : undefined,
        problemSolvingScore:
          session.type === InterviewType.CASE_STUDY || session.type === InterviewType.MIXED
            ? avgScore
            : undefined,
      },
      strengths: [isGerman ? 'Sie haben alle Fragen beantwortet' : 'You answered all questions'],
      improvements: [
        isGerman
          ? 'Üben Sie regelmäßig, um Ihre Antworten zu verbessern'
          : 'Practice regularly to improve your answers',
      ],
      recommendations: [
        isGerman
          ? 'Nutzen Sie konkrete Beispiele aus Ihrer Erfahrung'
          : 'Use concrete examples from your experience',
        isGerman
          ? 'Strukturieren Sie Ihre Antworten mit der STAR-Methode'
          : 'Structure your answers using the STAR method',
      ],
      summaryFeedback: isGerman
        ? `Sie haben das Interview mit einem Durchschnittswert von ${avgScore}/100 abgeschlossen. Nutzen Sie das Feedback der einzelnen Fragen, um sich gezielt zu verbessern.`
        : `You completed the interview with an average score of ${avgScore}/100. Use the feedback from individual questions to improve specifically.`,
    };
  }
}
