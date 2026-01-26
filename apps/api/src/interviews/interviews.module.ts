import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LLMModule } from '../llm/llm.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { InterviewsController } from './interviews.controller';
import { InterviewsService } from './interviews.service';
import { InterviewQuestionGeneratorService } from './services/question-generator.service';
import { InterviewAnswerAnalyzerService } from './services/answer-analyzer.service';
import { InterviewFeedbackGeneratorService } from './services/feedback-generator.service';

@Module({
  imports: [PrismaModule, LLMModule, SubscriptionModule],
  controllers: [InterviewsController],
  providers: [
    InterviewsService,
    InterviewQuestionGeneratorService,
    InterviewAnswerAnalyzerService,
    InterviewFeedbackGeneratorService,
  ],
  exports: [InterviewsService],
})
export class InterviewsModule {}
