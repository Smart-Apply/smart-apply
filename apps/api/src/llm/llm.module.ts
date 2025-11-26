import { Module } from '@nestjs/common';
import { HttpModule, HttpService } from '@nestjs/axios';
import { LLMService } from './llm.service';
import { AzureOpenAIProvider } from './providers/azure-openai.provider';
import { AzureAIFoundryProvider } from './providers/azure-ai-foundry.provider';
import { MockLLMProvider } from './providers/mock.provider';
import { HuggingFaceLLMProvider } from './providers/huggingface-llm.provider';
import { ConfigService } from '../config/config.service';

@Module({
  imports: [HttpModule],
  providers: [
    {
      provide: 'LLM_PROVIDER',
      useFactory: (configService: ConfigService, httpService: HttpService) => {
        const provider = configService.llmProvider;
        if (provider === 'azure-openai') {
          return new AzureOpenAIProvider(httpService, configService);
        }
        if (provider === 'azure-ai-foundry') {
          return new AzureAIFoundryProvider(httpService, configService);
        }
        if (provider === 'huggingface') {
          return new HuggingFaceLLMProvider(configService);
        }
        return new MockLLMProvider();
      },
      inject: [ConfigService, HttpService],
    },
    // Direct Azure OpenAI provider for simple tasks (title generation, etc.)
    {
      provide: 'AZURE_OPENAI_PROVIDER',
      useFactory: (configService: ConfigService, httpService: HttpService) => {
        return new AzureOpenAIProvider(httpService, configService);
      },
      inject: [ConfigService, HttpService],
    },
    LLMService,
  ],
  exports: [LLMService, 'AZURE_OPENAI_PROVIDER'],
})
export class LLMModule {}
