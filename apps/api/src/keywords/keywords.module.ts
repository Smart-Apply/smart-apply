import { Module } from '@nestjs/common';
import { KeywordsService } from './keywords.service';
import { PrismaModule } from '../prisma/prisma.module';
import { LLMModule } from '../llm/llm.module';

@Module({
  imports: [PrismaModule, LLMModule],
  providers: [KeywordsService],
  exports: [KeywordsService],
})
export class KeywordsModule {}
