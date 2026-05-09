import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  InterviewType,
  InterviewDifficulty,
  InterviewSessionStatus,
  InterviewQuestionType,
} from '../../generated/prisma/client';

/**
 * Response DTO for an interview question
 */
export class InterviewQuestionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  questionText: string;

  @ApiProperty({ enum: InterviewQuestionType })
  questionType: InterviewQuestionType;

  @ApiProperty()
  order: number;

  @ApiPropertyOptional()
  userAnswer?: string;

  @ApiPropertyOptional()
  answerDuration?: number;

  @ApiPropertyOptional({ description: 'Score 1-100' })
  score?: number;

  @ApiPropertyOptional()
  feedback?: string;

  @ApiPropertyOptional({ type: [String] })
  improvementTips?: string[];

  @ApiProperty()
  askedAt: Date;

  @ApiPropertyOptional()
  answeredAt?: Date;
}

/**
 * Response DTO for interview feedback
 */
export class InterviewFeedbackResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'Overall score 1-100' })
  overallScore: number;

  @ApiPropertyOptional({ description: 'Technical competence score 1-100' })
  technicalScore?: number;

  @ApiProperty({ description: 'Communication score 1-100' })
  communicationScore: number;

  @ApiProperty({ description: 'Self-presentation score 1-100' })
  presentationScore: number;

  @ApiPropertyOptional({ description: 'Problem-solving score 1-100' })
  problemSolvingScore?: number;

  @ApiPropertyOptional({ description: 'Culture fit score 1-100' })
  cultureFitScore?: number;

  @ApiProperty({ type: [String], description: 'Identified strengths' })
  strengths: string[];

  @ApiProperty({ type: [String], description: 'Areas for improvement' })
  improvements: string[];

  @ApiProperty({ type: [String], description: 'Specific recommendations' })
  recommendations: string[];

  @ApiPropertyOptional({ description: 'Example ideal answers' })
  idealAnswers?: Record<string, string>;

  @ApiProperty()
  createdAt: Date;
}

/**
 * Response DTO for an interview session
 */
export class InterviewSessionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: InterviewType })
  type: InterviewType;

  @ApiPropertyOptional()
  industry?: string;

  @ApiProperty({ enum: InterviewDifficulty })
  difficulty: InterviewDifficulty;

  @ApiProperty()
  language: string;

  @ApiPropertyOptional()
  jobTitle?: string;

  @ApiPropertyOptional()
  company?: string;

  @ApiPropertyOptional()
  applicationId?: string;

  @ApiProperty()
  maxQuestions: number;

  @ApiPropertyOptional()
  timeLimitMinutes?: number;

  @ApiProperty({ enum: InterviewSessionStatus })
  status: InterviewSessionStatus;

  @ApiProperty()
  startedAt: Date;

  @ApiPropertyOptional()
  completedAt?: Date;

  @ApiPropertyOptional({ description: 'Overall score 1-100' })
  overallScore?: number;

  @ApiProperty({ description: 'Number of questions asked' })
  questionsCount: number;

  @ApiProperty({ description: 'Number of questions answered' })
  answeredCount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

/**
 * Response DTO for a session with questions
 */
export class InterviewSessionDetailResponseDto extends InterviewSessionResponseDto {
  @ApiProperty({ type: [InterviewQuestionResponseDto] })
  questions: InterviewQuestionResponseDto[];

  @ApiPropertyOptional({ type: InterviewFeedbackResponseDto })
  feedback?: InterviewFeedbackResponseDto;
}

/**
 * Response DTO for the next question in a session
 */
export class NextQuestionResponseDto {
  @ApiProperty({ type: InterviewQuestionResponseDto })
  question: InterviewQuestionResponseDto;

  @ApiProperty({ description: 'Current question number' })
  currentQuestion: number;

  @ApiProperty({ description: 'Total questions in session' })
  totalQuestions: number;

  @ApiProperty({ description: 'Whether this is the last question' })
  isLastQuestion: boolean;
}

/**
 * Response DTO for answer submission
 */
export class AnswerResponseDto {
  @ApiProperty({ description: 'Whether the answer was accepted' })
  success: boolean;

  @ApiProperty({
    type: InterviewQuestionResponseDto,
    description: 'Updated question with evaluation',
  })
  question: InterviewQuestionResponseDto;

  @ApiProperty({ description: 'Whether there are more questions' })
  hasMoreQuestions: boolean;

  @ApiPropertyOptional({ description: 'Message about the answer' })
  message?: string;
}

/**
 * Response DTO for interview statistics
 */
export class InterviewStatsResponseDto {
  @ApiProperty({ description: 'Total number of sessions' })
  totalSessions: number;

  @ApiProperty({ description: 'Number of completed sessions' })
  completedSessions: number;

  @ApiProperty({ description: 'Number of completed sessions with a score > 0' })
  scoredSessions: number;

  @ApiProperty({ description: 'Average score across all sessions' })
  averageScore: number;

  @ApiProperty({ description: 'Best score achieved' })
  bestScore: number;

  @ApiProperty({ description: 'Total questions answered' })
  totalQuestionsAnswered: number;

  @ApiProperty({ description: 'Average score improvement over time' })
  scoreImprovement: number;

  @ApiProperty({ description: 'Most practiced interview type' })
  mostPracticedType: InterviewType;

  @ApiProperty({ description: 'Sessions by type' })
  sessionsByType: Record<InterviewType, number>;

  @ApiProperty({ description: 'Average category scores' })
  averageCategoryScores: {
    technical?: number;
    communication: number;
    presentation: number;
    problemSolving?: number;
    cultureFit?: number;
  };
}
