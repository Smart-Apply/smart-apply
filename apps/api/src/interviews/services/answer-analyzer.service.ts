import { Injectable, Logger } from '@nestjs/common';
import { LLMService } from '../../llm/llm.service';
import { InterviewDifficulty, InterviewQuestionType } from '../../generated/prisma/client';

/**
 * Context for analyzing an answer
 */
export interface AnswerAnalysisContext {
  jobTitle: string;
  company?: string;
  industry?: string;
  difficulty: InterviewDifficulty;
  language: string;
  questionText: string;
  questionType: InterviewQuestionType;
  expectedTopics: string[];
  userAnswer: string;
  answerDuration?: number;
}

/**
 * Score breakdown by category
 */
export interface ScoreBreakdown {
  completeness: number; // 0-20
  structure: number; // 0-20
  relevance: number; // 0-20
  depth: number; // 0-20
  professionalism: number; // 0-20
}

/**
 * Analysis result for an answer
 */
export interface AnswerAnalysis {
  score: number; // 1-100 overall score
  breakdown: ScoreBreakdown;
  strengths: string[];
  weaknesses: string[];
  improvementTips: string[];
  feedback: string;
  idealAnswerHint?: string;
}

/**
 * LLM response structure for answer analysis
 */
interface AnswerAnalysisLLMResponse {
  score: number;
  breakdown: {
    completeness: number;
    structure: number;
    relevance: number;
    depth: number;
    professionalism: number;
  };
  strengths: string[];
  weaknesses: string[];
  improvementTips: string[];
  feedback: string;
  idealAnswerHint?: string;
}

@Injectable()
export class InterviewAnswerAnalyzerService {
  private readonly logger = new Logger(InterviewAnswerAnalyzerService.name);

  constructor(private readonly llmService: LLMService) {}

  /**
   * Analyze a user's answer to an interview question
   */
  async analyzeAnswer(context: AnswerAnalysisContext): Promise<AnswerAnalysis> {
    this.logger.log(`Analyzing answer for question: ${context.questionText.substring(0, 50)}...`);

    // Build prompt context
    const promptContext = {
      jobTitle: context.jobTitle || 'Unbekannte Position',
      company: context.company || 'Unbekanntes Unternehmen',
      industry: context.industry || 'Allgemein',
      difficulty: this.getDifficultyLabel(context.difficulty),
      language: context.language === 'de' ? 'Deutsch' : 'English',
      questionText: context.questionText,
      questionType: context.questionType,
      expectedTopics: context.expectedTopics.join(', '),
      userAnswer: context.userAnswer,
      answerDuration: context.answerDuration ? `${context.answerDuration}` : 'Nicht gemessen',
    };

    try {
      // Use LLM to analyze answer
      const response = await this.llmService.callJson<AnswerAnalysisLLMResponse>(
        'interview-answer-analyzer.md',
        promptContext,
        {
          temperature: 0.5, // Lower temperature for more consistent evaluation
          maxTokens: 800,
        },
      );

      // Validate and normalize response
      const score = Math.min(100, Math.max(1, Number(response.score) || 50));

      const breakdown: ScoreBreakdown = {
        completeness: Math.min(20, Math.max(0, Number(response.breakdown?.completeness) || 10)),
        structure: Math.min(20, Math.max(0, Number(response.breakdown?.structure) || 10)),
        relevance: Math.min(20, Math.max(0, Number(response.breakdown?.relevance) || 10)),
        depth: Math.min(20, Math.max(0, Number(response.breakdown?.depth) || 10)),
        professionalism: Math.min(
          20,
          Math.max(0, Number(response.breakdown?.professionalism) || 10),
        ),
      };

      const result: AnswerAnalysis = {
        score,
        breakdown,
        strengths: response.strengths || [],
        weaknesses: response.weaknesses || [],
        improvementTips: response.improvementTips || [],
        feedback: response.feedback || 'Danke für Ihre Antwort.',
        idealAnswerHint: response.idealAnswerHint,
      };

      this.logger.debug(`Answer score: ${result.score}/100`);

      return result;
    } catch (error: any) {
      this.logger.error(`Failed to analyze answer: ${error.message}`);

      // Return a neutral fallback analysis
      return this.getFallbackAnalysis(context);
    }
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
   * Get a fallback analysis when LLM fails
   */
  private getFallbackAnalysis(context: AnswerAnalysisContext): AnswerAnalysis {
    // Calculate a basic score based on answer length
    const answerLength = context.userAnswer?.length || 0;
    let baseScore = 50;

    if (answerLength > 500) baseScore = 65;
    else if (answerLength > 200) baseScore = 60;
    else if (answerLength < 50) baseScore = 40;

    const feedback =
      context.language === 'de'
        ? 'Ihre Antwort wurde erfasst. Bitte beachten Sie, dass die detaillierte Analyse derzeit nicht verfügbar ist.'
        : 'Your answer has been recorded. Please note that detailed analysis is currently unavailable.';

    return {
      score: baseScore,
      breakdown: {
        completeness: 10,
        structure: 10,
        relevance: 10,
        depth: 10,
        professionalism: 10,
      },
      strengths: [
        context.language === 'de' ? 'Sie haben die Frage beantwortet' : 'You answered the question',
      ],
      weaknesses: [],
      improvementTips: [
        context.language === 'de'
          ? 'Versuchen Sie, konkrete Beispiele zu nennen'
          : 'Try to provide specific examples',
      ],
      feedback,
    };
  }
}
