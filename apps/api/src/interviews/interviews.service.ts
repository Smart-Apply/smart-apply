import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  InterviewSession,
  InterviewQuestion,
  InterviewFeedback,
  InterviewSessionStatus,
  InterviewType,
  InterviewDifficulty,
} from '../generated/prisma/client';
import { StartInterviewDto, SubmitAnswerDto } from './dto';
import {
  InterviewQuestionGeneratorService,
  QuestionGenerationContext,
} from './services/question-generator.service';
import {
  InterviewAnswerAnalyzerService,
  AnswerAnalysisContext,
} from './services/answer-analyzer.service';
import {
  InterviewFeedbackGeneratorService,
  FeedbackGenerationContext,
} from './services/feedback-generator.service';

/**
 * Session with questions and optional feedback
 */
export type SessionWithQuestions = InterviewSession & {
  questions: InterviewQuestion[];
  feedback?: InterviewFeedback | null;
};

/**
 * Interview statistics for a user
 */
export interface InterviewStats {
  totalSessions: number;
  completedSessions: number;
  scoredSessions: number;
  averageScore: number;
  bestScore: number;
  totalQuestionsAnswered: number;
  scoreImprovement: number;
  mostPracticedType: InterviewType;
  sessionsByType: Record<InterviewType, number>;
  averageCategoryScores: {
    technical?: number;
    communication: number;
    presentation: number;
    problemSolving?: number;
    cultureFit?: number;
  };
}

@Injectable()
export class InterviewsService {
  private readonly logger = new Logger(InterviewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly questionGenerator: InterviewQuestionGeneratorService,
    private readonly answerAnalyzer: InterviewAnswerAnalyzerService,
    private readonly feedbackGenerator: InterviewFeedbackGeneratorService,
  ) {}

  /**
   * Start a new interview session
   */
  async startSession(userId: string, dto: StartInterviewDto): Promise<SessionWithQuestions> {
    this.logger.log(`Starting new interview session for user ${userId}`);

    // Get application context if provided
    let jobTitle = dto.jobTitle;
    let company = dto.company;
    let jobDescription = dto.jobDescription;

    if (dto.applicationId) {
      const application = await this.prisma.application.findFirst({
        where: {
          id: dto.applicationId,
          userId,
          deletedAt: null,
        },
        include: {
          jobPosting: true,
        },
      });

      if (!application) {
        throw new NotFoundException('Bewerbung nicht gefunden');
      }

      jobTitle = jobTitle || application.jobPosting.title;
      company = company || application.jobPosting.company;
      jobDescription = jobDescription || application.jobPosting.fullText;
    }

    // Create the session
    const session = await this.prisma.interviewSession.create({
      data: {
        userId,
        applicationId: dto.applicationId,
        type: dto.type || InterviewType.MIXED,
        industry: dto.industry,
        difficulty: dto.difficulty || InterviewDifficulty.MEDIUM,
        language: dto.language || 'de',
        jobTitle,
        company,
        jobDescription,
        maxQuestions: dto.maxQuestions || 10,
        timeLimitMinutes: dto.timeLimitMinutes,
        status: InterviewSessionStatus.IN_PROGRESS,
      },
      include: {
        questions: true,
      },
    });

    // Generate the first question
    const firstQuestion = await this.generateAndSaveQuestion(session, 1);

    return {
      ...session,
      questions: [firstQuestion],
      feedback: null,
    };
  }

  /**
   * Get a session by ID with authorization check
   */
  async getSession(userId: string, sessionId: string): Promise<SessionWithQuestions> {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
        },
        feedback: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Interview-Session nicht gefunden');
    }

    if (session.userId !== userId) {
      throw new ForbiddenException('Zugriff verweigert');
    }

    return session;
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(
    userId: string,
    options?: {
      status?: InterviewSessionStatus;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ sessions: InterviewSession[]; total: number }> {
    const where = {
      userId,
      ...(options?.status && { status: options.status }),
    };

    const [sessions, total] = await Promise.all([
      this.prisma.interviewSession.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 20,
        skip: options?.offset || 0,
        include: {
          _count: {
            select: { questions: true },
          },
        },
      }),
      this.prisma.interviewSession.count({ where }),
    ]);

    return { sessions, total };
  }

  /**
   * Submit an answer to a question
   */
  async submitAnswer(
    userId: string,
    sessionId: string,
    questionId: string,
    dto: SubmitAnswerDto,
  ): Promise<InterviewQuestion> {
    // Get session and validate
    const session = await this.getSession(userId, sessionId);

    if (session.status !== InterviewSessionStatus.IN_PROGRESS) {
      throw new BadRequestException('Interview-Session ist nicht mehr aktiv');
    }

    // Find the question
    const question = session.questions.find((q) => q.id === questionId);
    if (!question) {
      throw new NotFoundException('Frage nicht gefunden');
    }

    if (question.userAnswer) {
      throw new BadRequestException('Diese Frage wurde bereits beantwortet');
    }

    // Analyze the answer
    const analysisContext: AnswerAnalysisContext = {
      jobTitle: session.jobTitle || '',
      company: session.company || undefined,
      industry: session.industry || undefined,
      difficulty: session.difficulty,
      language: session.language,
      questionText: question.questionText,
      questionType: question.questionType,
      expectedTopics: question.expectedTopics,
      userAnswer: dto.answer,
      answerDuration: dto.answerDuration,
    };

    const analysis = await this.answerAnalyzer.analyzeAnswer(analysisContext);

    // Update the question with answer and analysis
    const updatedQuestion = await this.prisma.interviewQuestion.update({
      where: { id: questionId },
      data: {
        userAnswer: dto.answer,
        answerDuration: dto.answerDuration,
        score: analysis.score,
        feedback: analysis.feedback,
        improvementTips: analysis.improvementTips,
        answeredAt: new Date(),
      },
    });

    return updatedQuestion;
  }

  /**
   * Get or generate the next question
   */
  async getNextQuestion(
    userId: string,
    sessionId: string,
  ): Promise<{
    question: InterviewQuestion;
    currentQuestion: number;
    totalQuestions: number;
    isLastQuestion: boolean;
  }> {
    const session = await this.getSession(userId, sessionId);

    if (session.status !== InterviewSessionStatus.IN_PROGRESS) {
      throw new BadRequestException('Interview-Session ist nicht mehr aktiv');
    }

    // Check if there are unanswered questions
    const unansweredQuestion = session.questions.find((q) => !q.userAnswer);
    if (unansweredQuestion) {
      return {
        question: unansweredQuestion,
        currentQuestion: unansweredQuestion.order,
        totalQuestions: session.maxQuestions,
        isLastQuestion: unansweredQuestion.order >= session.maxQuestions,
      };
    }

    // Check if we've reached the max questions
    const currentQuestionCount = session.questions.length;
    if (currentQuestionCount >= session.maxQuestions) {
      throw new BadRequestException(
        'Alle Fragen wurden beantwortet. Bitte beenden Sie die Session.',
      );
    }

    // Generate next question
    const nextQuestion = await this.generateAndSaveQuestion(session, currentQuestionCount + 1);

    return {
      question: nextQuestion,
      currentQuestion: nextQuestion.order,
      totalQuestions: session.maxQuestions,
      isLastQuestion: nextQuestion.order >= session.maxQuestions,
    };
  }

  /**
   * Complete the interview session and generate feedback
   */
  async completeSession(userId: string, sessionId: string): Promise<SessionWithQuestions> {
    const session = await this.getSession(userId, sessionId);

    if (session.status !== InterviewSessionStatus.IN_PROGRESS) {
      throw new BadRequestException('Interview-Session ist nicht mehr aktiv');
    }

    // Check that at least one question was answered
    const answeredQuestions = session.questions.filter((q) => q.userAnswer);
    if (answeredQuestions.length === 0) {
      throw new BadRequestException(
        'Mindestens eine Frage muss beantwortet werden, bevor die Session beendet werden kann.',
      );
    }

    // Get profile summary for feedback context
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });

    // Generate comprehensive feedback
    const feedbackContext: FeedbackGenerationContext = {
      session,
      profileSummary: profile?.summary || undefined,
    };

    const feedback = await this.feedbackGenerator.generateFeedback(feedbackContext);

    // Save feedback and update session
    await this.prisma.$transaction([
      this.prisma.interviewFeedback.create({
        data: {
          sessionId,
          overallScore: feedback.overallScore,
          technicalScore: feedback.categoryScores.technicalScore,
          communicationScore: feedback.categoryScores.communicationScore,
          presentationScore: feedback.categoryScores.presentationScore,
          problemSolvingScore: feedback.categoryScores.problemSolvingScore,
          cultureFitScore: feedback.categoryScores.cultureFitScore,
          strengths: feedback.strengths,
          improvements: feedback.improvements,
          recommendations: feedback.recommendations,
          idealAnswers: feedback.idealAnswers || undefined,
        },
      }),
      this.prisma.interviewSession.update({
        where: { id: sessionId },
        data: {
          status: InterviewSessionStatus.COMPLETED,
          completedAt: new Date(),
          overallScore: feedback.overallScore,
        },
      }),
    ]);

    // Return updated session
    return this.getSession(userId, sessionId);
  }

  /**
   * Abandon (cancel) a session
   */
  async abandonSession(userId: string, sessionId: string): Promise<InterviewSession> {
    const session = await this.getSession(userId, sessionId);

    if (session.status !== InterviewSessionStatus.IN_PROGRESS) {
      throw new BadRequestException('Diese Session kann nicht mehr abgebrochen werden');
    }

    return this.prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        status: InterviewSessionStatus.ABANDONED,
        completedAt: new Date(),
      },
    });
  }

  /**
   * Get interview statistics for a user
   */
  async getStats(userId: string): Promise<InterviewStats> {
    // Get all completed sessions with feedback
    const sessions = await this.prisma.interviewSession.findMany({
      where: {
        userId,
        status: InterviewSessionStatus.COMPLETED,
      },
      include: {
        feedback: true,
        questions: true,
      },
      orderBy: { completedAt: 'asc' },
    });

    const totalSessions = await this.prisma.interviewSession.count({
      where: { userId },
    });

    if (sessions.length === 0) {
      return {
        totalSessions,
        completedSessions: 0,
        scoredSessions: 0,
        averageScore: 0,
        bestScore: 0,
        totalQuestionsAnswered: 0,
        scoreImprovement: 0,
        mostPracticedType: InterviewType.MIXED,
        sessionsByType: {
          BEHAVIORAL: 0,
          TECHNICAL: 0,
          CASE_STUDY: 0,
          MIXED: 0,
        },
        averageCategoryScores: {
          communication: 0,
          presentation: 0,
        },
      };
    }

    // Calculate statistics
    const scores = sessions.map((s) => s.overallScore || 0).filter((s) => s > 0);
    const averageScore =
      scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const bestScore = Math.max(...scores, 0);

    // Calculate score improvement (compare first half to second half)
    let scoreImprovement = 0;
    if (scores.length >= 4) {
      const midpoint = Math.floor(scores.length / 2);
      const firstHalf = scores.slice(0, midpoint);
      const secondHalf = scores.slice(midpoint);
      const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      scoreImprovement = Math.round(avgSecond - avgFirst);
    }

    // Count by type
    const sessionsByType: Record<InterviewType, number> = {
      BEHAVIORAL: 0,
      TECHNICAL: 0,
      CASE_STUDY: 0,
      MIXED: 0,
    };
    sessions.forEach((s) => {
      sessionsByType[s.type]++;
    });

    // Find most practiced type
    const mostPracticedType = (Object.entries(sessionsByType) as [InterviewType, number][]).sort(
      (a, b) => b[1] - a[1],
    )[0][0];

    // Calculate average category scores
    const feedbacks = sessions.map((s) => s.feedback).filter(Boolean);
    const avgCategoryScores = {
      communication: this.avgNonNull(feedbacks.map((f) => f?.communicationScore)),
      presentation: this.avgNonNull(feedbacks.map((f) => f?.presentationScore)),
      technical: this.avgNonNull(feedbacks.map((f) => f?.technicalScore)),
      problemSolving: this.avgNonNull(feedbacks.map((f) => f?.problemSolvingScore)),
      cultureFit: this.avgNonNull(feedbacks.map((f) => f?.cultureFitScore)),
    };

    // Count total questions answered
    const totalQuestionsAnswered = sessions.reduce(
      (sum, s) => sum + s.questions.filter((q) => q.userAnswer).length,
      0,
    );

    return {
      totalSessions,
      completedSessions: sessions.length,
      scoredSessions: scores.length,
      averageScore,
      bestScore,
      totalQuestionsAnswered,
      scoreImprovement,
      mostPracticedType,
      sessionsByType,
      averageCategoryScores: avgCategoryScores,
    };
  }

  /**
   * Generate and save a new question for a session
   */
  private async generateAndSaveQuestion(
    session: SessionWithQuestions | InterviewSession,
    order: number,
  ): Promise<InterviewQuestion> {
    // Get previous questions for context
    const previousQuestions =
      'questions' in session
        ? session.questions.map((q) => q.questionText)
        : await this.prisma.interviewQuestion
            .findMany({
              where: { sessionId: session.id },
              orderBy: { order: 'asc' },
            })
            .then((qs) => qs.map((q) => q.questionText));

    // Get last answer if available
    const lastQuestion =
      previousQuestions.length > 0
        ? await this.prisma.interviewQuestion.findFirst({
            where: {
              sessionId: session.id,
              order: order - 1,
            },
          })
        : null;

    // Generate context for LLM
    const context: QuestionGenerationContext = {
      jobTitle: session.jobTitle || '',
      company: session.company || undefined,
      industry: session.industry || undefined,
      interviewType: session.type,
      difficulty: session.difficulty,
      language: session.language,
      questionNumber: order,
      totalQuestions: session.maxQuestions,
      jobDescription: session.jobDescription || undefined,
      previousQuestions,
      lastAnswer: lastQuestion?.userAnswer || undefined,
    };

    // Generate question
    const generatedQuestion = await this.questionGenerator.generateQuestion(context);

    // Save to database
    return this.prisma.interviewQuestion.create({
      data: {
        sessionId: session.id,
        questionText: generatedQuestion.questionText,
        questionType: generatedQuestion.questionType,
        expectedTopics: generatedQuestion.expectedTopics,
        order,
      },
    });
  }

  /**
   * Calculate average of non-null numbers
   */
  private avgNonNull(values: (number | null | undefined)[]): number {
    const valid = values.filter((v): v is number => v !== null && v !== undefined);
    if (valid.length === 0) return 0;
    return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
  }
}
