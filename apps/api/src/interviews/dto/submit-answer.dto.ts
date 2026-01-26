import { IsString, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for submitting an answer to a question
 */
export class SubmitAnswerDto {
  @ApiProperty({
    description: 'User\'s answer to the question',
    example: 'In meiner vorherigen Position habe ich ein Team von 5 Entwicklern geleitet...',
  })
  @IsString()
  answer: string;

  @ApiPropertyOptional({
    description: 'Time taken to answer in seconds',
    example: 120,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  answerDuration?: number;
}
