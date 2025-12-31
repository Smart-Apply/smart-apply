import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';
import { Sanitize } from '../../common/decorators/sanitize.decorator';

export const TARGET_JOB_TITLE_MIN_LENGTH = 2;
export const TARGET_JOB_TITLE_MAX_LENGTH = 100;

export class UpdateTargetJobTitleDto {
  @ApiProperty({
    description: 'Target job title to display on CV/Cover Letter',
    example: 'Senior Software Engineer',
    minLength: TARGET_JOB_TITLE_MIN_LENGTH,
    maxLength: TARGET_JOB_TITLE_MAX_LENGTH,
  })
  @IsString()
  @MinLength(TARGET_JOB_TITLE_MIN_LENGTH, {
    message: `Target job title must be at least ${TARGET_JOB_TITLE_MIN_LENGTH} characters long`,
  })
  @MaxLength(TARGET_JOB_TITLE_MAX_LENGTH, {
    message: `Target job title must be at most ${TARGET_JOB_TITLE_MAX_LENGTH} characters long`,
  })
  @Sanitize()
  targetJobTitle: string;
}
