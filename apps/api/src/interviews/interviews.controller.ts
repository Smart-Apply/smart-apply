import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TierGuard } from '../common/guards/tier.guard';
import { FeatureGuard } from '../common/guards/feature.guard';
import { UsageLimitGuard } from '../common/guards/usage-limit.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequiresPremium, RequiresFeature, CheckUsage } from '../common/decorators/tier.decorator';
import { InterviewsService } from './interviews.service';
import {
  StartInterviewDto,
  SubmitAnswerDto,
  InterviewSessionResponseDto,
  InterviewSessionDetailResponseDto,
  NextQuestionResponseDto,
  AnswerResponseDto,
  InterviewStatsResponseDto,
  InterviewQuestionResponseDto,
} from './dto';
import { InterviewSessionStatus } from '../generated/prisma/client';

interface AuthenticatedUser {
  id: string;
  email: string;
}

@ApiTags('Interviews')
@ApiBearerAuth()
@Controller('interviews')
@UseGuards(JwtAuthGuard)
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  /**
   * Start a new interview session
   * Premium feature - requires Premium subscription
   */
  @Post('start')
  @UseGuards(TierGuard, FeatureGuard, UsageLimitGuard)
  @RequiresPremium()
  @RequiresFeature('interviewCoach')
  @CheckUsage('interview')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 starts per minute
  @ApiOperation({
    summary: 'Start a new interview session',
    description:
      'Starts a new AI interview coaching session. Can be based on an existing application or custom job details. Premium feature only.',
  })
  @ApiResponse({
    status: 201,
    description: 'Interview session started successfully',
    type: InterviewSessionDetailResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Premium subscription required' })
  async startSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StartInterviewDto,
  ): Promise<InterviewSessionDetailResponseDto> {
    const session = await this.interviewsService.startSession(user.id, dto);

    return this.mapSessionToDetailResponse(session);
  }

  /**
   * Get all interview sessions for the current user
   */
  @Get()
  @UseGuards(TierGuard, FeatureGuard)
  @RequiresPremium()
  @RequiresFeature('interviewCoach')
  @ApiOperation({
    summary: 'List all interview sessions',
    description: 'Returns a list of all interview sessions for the authenticated user.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: InterviewSessionStatus,
    description: 'Filter by session status',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'List of interview sessions',
    type: [InterviewSessionResponseDto],
  })
  async listSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: InterviewSessionStatus,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<{ sessions: InterviewSessionResponseDto[]; total: number }> {
    const result = await this.interviewsService.getUserSessions(user.id, {
      status,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });

    return {
      sessions: result.sessions.map((s) => this.mapSessionToResponse(s)),
      total: result.total,
    };
  }

  /**
   * Get interview statistics
   */
  @Get('stats')
  @UseGuards(TierGuard, FeatureGuard)
  @RequiresPremium()
  @RequiresFeature('interviewCoach')
  @ApiOperation({
    summary: 'Get interview statistics',
    description: "Returns statistics about the user's interview practice history.",
  })
  @ApiResponse({
    status: 200,
    description: 'Interview statistics',
    type: InterviewStatsResponseDto,
  })
  async getStats(@CurrentUser() user: AuthenticatedUser): Promise<InterviewStatsResponseDto> {
    return this.interviewsService.getStats(user.id);
  }

  /**
   * Get a specific interview session
   */
  @Get(':id')
  @UseGuards(TierGuard, FeatureGuard)
  @RequiresPremium()
  @RequiresFeature('interviewCoach')
  @ApiOperation({
    summary: 'Get interview session details',
    description: 'Returns detailed information about a specific interview session.',
  })
  @ApiParam({ name: 'id', description: 'Interview session ID' })
  @ApiResponse({
    status: 200,
    description: 'Interview session details',
    type: InterviewSessionDetailResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async getSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') sessionId: string,
  ): Promise<InterviewSessionDetailResponseDto> {
    const session = await this.interviewsService.getSession(user.id, sessionId);
    return this.mapSessionToDetailResponse(session);
  }

  /**
   * Submit an answer to a question
   */
  @Post(':id/questions/:questionId/answer')
  @UseGuards(TierGuard, FeatureGuard)
  @RequiresPremium()
  @RequiresFeature('interviewCoach')
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 answers per minute
  @ApiOperation({
    summary: 'Submit answer to a question',
    description: 'Submit an answer to an interview question and receive AI feedback.',
  })
  @ApiParam({ name: 'id', description: 'Interview session ID' })
  @ApiParam({ name: 'questionId', description: 'Question ID' })
  @ApiResponse({
    status: 200,
    description: 'Answer submitted and evaluated',
    type: AnswerResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid answer or session not active' })
  async submitAnswer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') sessionId: string,
    @Param('questionId') questionId: string,
    @Body() dto: SubmitAnswerDto,
  ): Promise<AnswerResponseDto> {
    const question = await this.interviewsService.submitAnswer(user.id, sessionId, questionId, dto);

    // Check if there are more questions
    const session = await this.interviewsService.getSession(user.id, sessionId);
    const answeredCount = session.questions.filter((q) => q.userAnswer).length;
    const hasMoreQuestions = answeredCount < session.maxQuestions;

    return {
      success: true,
      question: this.mapQuestionToResponse(question),
      hasMoreQuestions,
      message: hasMoreQuestions
        ? 'Antwort erfasst. Fahren Sie mit der nächsten Frage fort.'
        : 'Letzte Frage beantwortet. Sie können die Session jetzt beenden.',
    };
  }

  /**
   * Get the next question in the session
   */
  @Post(':id/next')
  @UseGuards(TierGuard, FeatureGuard)
  @RequiresPremium()
  @RequiresFeature('interviewCoach')
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 next requests per minute
  @ApiOperation({
    summary: 'Get next question',
    description:
      'Get the next question in the interview session. Generates a new question if needed.',
  })
  @ApiParam({ name: 'id', description: 'Interview session ID' })
  @ApiResponse({
    status: 200,
    description: 'Next question retrieved',
    type: NextQuestionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'No more questions or session not active' })
  async getNextQuestion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') sessionId: string,
  ): Promise<NextQuestionResponseDto> {
    const result = await this.interviewsService.getNextQuestion(user.id, sessionId);

    return {
      question: this.mapQuestionToResponse(result.question),
      currentQuestion: result.currentQuestion,
      totalQuestions: result.totalQuestions,
      isLastQuestion: result.isLastQuestion,
    };
  }

  /**
   * Complete the interview session
   */
  @Post(':id/complete')
  @UseGuards(TierGuard, FeatureGuard)
  @RequiresPremium()
  @RequiresFeature('interviewCoach')
  @ApiOperation({
    summary: 'Complete interview session',
    description: 'Complete the interview session and generate comprehensive feedback.',
  })
  @ApiParam({ name: 'id', description: 'Interview session ID' })
  @ApiResponse({
    status: 200,
    description: 'Session completed with feedback',
    type: InterviewSessionDetailResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Session cannot be completed' })
  async completeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') sessionId: string,
  ): Promise<InterviewSessionDetailResponseDto> {
    const session = await this.interviewsService.completeSession(user.id, sessionId);
    return this.mapSessionToDetailResponse(session);
  }

  /**
   * Abandon (cancel) an interview session
   */
  @Post(':id/abandon')
  @UseGuards(TierGuard, FeatureGuard)
  @RequiresPremium()
  @RequiresFeature('interviewCoach')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Abandon interview session',
    description: 'Cancel an in-progress interview session without completing it.',
  })
  @ApiParam({ name: 'id', description: 'Interview session ID' })
  @ApiResponse({
    status: 200,
    description: 'Session abandoned',
    type: InterviewSessionResponseDto,
  })
  async abandonSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') sessionId: string,
  ): Promise<InterviewSessionResponseDto> {
    const session = await this.interviewsService.abandonSession(user.id, sessionId);
    return this.mapSessionToResponse(session);
  }

  /**
   * Map session to response DTO
   */
  private mapSessionToResponse(session: any): InterviewSessionResponseDto {
    return {
      id: session.id,
      type: session.type,
      industry: session.industry,
      difficulty: session.difficulty,
      language: session.language,
      jobTitle: session.jobTitle,
      company: session.company,
      applicationId: session.applicationId,
      maxQuestions: session.maxQuestions,
      timeLimitMinutes: session.timeLimitMinutes,
      status: session.status,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      overallScore: session.overallScore,
      questionsCount: session._count?.questions || session.questions?.length || 0,
      answeredCount: session.questions?.filter((q: any) => q.userAnswer).length || 0,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  /**
   * Map session to detail response DTO
   */
  private mapSessionToDetailResponse(session: any): InterviewSessionDetailResponseDto {
    const base = this.mapSessionToResponse(session);

    return {
      ...base,
      questions: session.questions?.map((q: any) => this.mapQuestionToResponse(q)) || [],
      feedback: session.feedback
        ? {
            id: session.feedback.id,
            overallScore: session.feedback.overallScore,
            technicalScore: session.feedback.technicalScore,
            communicationScore: session.feedback.communicationScore,
            presentationScore: session.feedback.presentationScore,
            problemSolvingScore: session.feedback.problemSolvingScore,
            cultureFitScore: session.feedback.cultureFitScore,
            strengths: session.feedback.strengths,
            improvements: session.feedback.improvements,
            recommendations: session.feedback.recommendations,
            idealAnswers: session.feedback.idealAnswers as Record<string, string>,
            createdAt: session.feedback.createdAt,
          }
        : undefined,
    };
  }

  /**
   * Map question to response DTO
   */
  private mapQuestionToResponse(question: any): InterviewQuestionResponseDto {
    return {
      id: question.id,
      questionText: question.questionText,
      questionType: question.questionType,
      order: question.order,
      userAnswer: question.userAnswer,
      answerDuration: question.answerDuration,
      score: question.score,
      feedback: question.feedback,
      improvementTips: question.improvementTips,
      askedAt: question.askedAt,
      answeredAt: question.answeredAt,
    };
  }
}
