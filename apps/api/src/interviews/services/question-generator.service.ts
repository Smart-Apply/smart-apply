import { Injectable, Logger } from '@nestjs/common';
import { LLMService } from '../../llm/llm.service';
import {
  InterviewType,
  InterviewDifficulty,
  InterviewQuestionType,
} from '../../generated/prisma/client';

/**
 * Question generation context for LLM
 */
export interface QuestionGenerationContext {
  jobTitle: string;
  company?: string;
  industry?: string;
  interviewType: InterviewType;
  difficulty: InterviewDifficulty;
  language: string;
  questionNumber: number;
  totalQuestions: number;
  profileSummary?: string;
  jobDescription?: string;
  previousQuestions: string[];
  lastAnswer?: string;
}

/**
 * Generated question structure
 */
export interface GeneratedQuestion {
  questionText: string;
  questionType: InterviewQuestionType;
  expectedTopics: string[];
  tips?: string;
}

/**
 * LLM response structure for question generation
 */
interface QuestionLLMResponse {
  questionText: string;
  questionType: string;
  expectedTopics: string[];
  difficulty: string;
  tips?: string;
}

@Injectable()
export class InterviewQuestionGeneratorService {
  private readonly logger = new Logger(InterviewQuestionGeneratorService.name);

  constructor(private readonly llmService: LLMService) {}

  /**
   * Generate the next interview question based on context
   */
  async generateQuestion(context: QuestionGenerationContext): Promise<GeneratedQuestion> {
    this.logger.log(
      `Generating question ${context.questionNumber}/${context.totalQuestions} for ${context.jobTitle}`,
    );

    // Build the prompt context
    const promptContext = {
      jobTitle: context.jobTitle || 'Unbekannte Position',
      company: context.company || 'Unbekanntes Unternehmen',
      industry: context.industry || 'Allgemein',
      interviewType: this.getInterviewTypeLabel(context.interviewType),
      difficulty: this.getDifficultyLabel(context.difficulty),
      language: context.language === 'de' ? 'Deutsch' : 'English',
      questionNumber: context.questionNumber,
      totalQuestions: context.totalQuestions,
      profileSummary: context.profileSummary || 'Keine Profilinformationen verfügbar',
      jobDescription: context.jobDescription || 'Keine Stellenbeschreibung verfügbar',
      previousQuestions:
        context.previousQuestions.length > 0
          ? context.previousQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')
          : 'Keine bisherigen Fragen',
      lastAnswer: context.lastAnswer || 'Keine vorherige Antwort',
    };

    try {
      // Use LLM to generate question
      const response = await this.llmService.callJson<QuestionLLMResponse>(
        'interview-question.md',
        promptContext,
        {
          temperature: 0.8, // Higher temperature for more diverse questions
          maxTokens: 500,
        },
      );

      // Map question type string to enum
      const questionType = this.mapQuestionType(response.questionType);

      const result: GeneratedQuestion = {
        questionText: response.questionText,
        questionType,
        expectedTopics: response.expectedTopics || [],
        tips: response.tips,
      };

      this.logger.debug(`Generated question: ${result.questionText.substring(0, 50)}...`);

      return result;
    } catch (error: any) {
      this.logger.error(`Failed to generate question: ${error.message}`);

      // Return a fallback question
      return this.getFallbackQuestion(context);
    }
  }

  /**
   * Map string to InterviewQuestionType enum
   */
  private mapQuestionType(type: string): InterviewQuestionType {
    const typeMap: Record<string, InterviewQuestionType> = {
      BEHAVIORAL: InterviewQuestionType.BEHAVIORAL,
      TECHNICAL: InterviewQuestionType.TECHNICAL,
      SITUATIONAL: InterviewQuestionType.SITUATIONAL,
      OPEN: InterviewQuestionType.OPEN,
      FOLLOW_UP: InterviewQuestionType.FOLLOW_UP,
    };

    return typeMap[type?.toUpperCase()] || InterviewQuestionType.OPEN;
  }

  /**
   * Get human-readable interview type label
   */
  private getInterviewTypeLabel(type: InterviewType): string {
    const labels: Record<InterviewType, string> = {
      BEHAVIORAL: 'Verhaltensbezogen (BEHAVIORAL)',
      TECHNICAL: 'Technisch/Fachlich (TECHNICAL)',
      CASE_STUDY: 'Fallstudie (CASE_STUDY)',
      MIXED: 'Gemischt (MIXED)',
    };
    return labels[type] || type;
  }

  /**
   * Get human-readable difficulty label
   */
  private getDifficultyLabel(difficulty: InterviewDifficulty): string {
    const labels: Record<InterviewDifficulty, string> = {
      EASY: 'Einsteiger (EASY)',
      MEDIUM: 'Standard (MEDIUM)',
      HARD: 'Experten (HARD)',
    };
    return labels[difficulty] || difficulty;
  }

  /**
   * Get a fallback question when LLM fails
   */
  private getFallbackQuestion(context: QuestionGenerationContext): GeneratedQuestion {
    const fallbackQuestions: Record<InterviewType, GeneratedQuestion[]> = {
      BEHAVIORAL: [
        {
          questionText:
            context.language === 'de'
              ? 'Erzählen Sie von einer Situation, in der Sie unter Druck erfolgreich gearbeitet haben.'
              : 'Tell me about a situation where you successfully worked under pressure.',
          questionType: InterviewQuestionType.BEHAVIORAL,
          expectedTopics: ['Stressmanagement', 'Problemlösung', 'Ergebnisorientierung'],
        },
        {
          questionText:
            context.language === 'de'
              ? 'Beschreiben Sie ein Beispiel, bei dem Sie ein Team erfolgreich geführt haben.'
              : 'Describe an example where you successfully led a team.',
          questionType: InterviewQuestionType.BEHAVIORAL,
          expectedTopics: ['Führung', 'Teamarbeit', 'Kommunikation'],
        },
      ],
      TECHNICAL: [
        {
          questionText:
            context.language === 'de'
              ? 'Welche technischen Herausforderungen haben Sie in Ihrer letzten Position gemeistert?'
              : 'What technical challenges have you overcome in your last position?',
          questionType: InterviewQuestionType.TECHNICAL,
          expectedTopics: ['Fachkompetenz', 'Problemlösung', 'Lernerfolge'],
        },
      ],
      CASE_STUDY: [
        {
          questionText:
            context.language === 'de'
              ? 'Wie würden Sie vorgehen, wenn Sie ein neues Produkt auf den Markt bringen müssten?'
              : 'How would you approach launching a new product to market?',
          questionType: InterviewQuestionType.SITUATIONAL,
          expectedTopics: ['Planung', 'Strategie', 'Marktanalyse'],
        },
      ],
      MIXED: [
        {
          questionText:
            context.language === 'de'
              ? 'Was motiviert Sie an dieser Position und warum sind Sie der richtige Kandidat?'
              : 'What motivates you about this position and why are you the right candidate?',
          questionType: InterviewQuestionType.OPEN,
          expectedTopics: ['Motivation', 'Selbsteinschätzung', 'Passung'],
        },
      ],
    };

    const questions = fallbackQuestions[context.interviewType] || fallbackQuestions.MIXED;
    const index = (context.questionNumber - 1) % questions.length;

    return questions[index];
  }
}
