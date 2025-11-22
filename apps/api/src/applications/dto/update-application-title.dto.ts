import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';
import { Sanitize } from '../../common/decorators/sanitize.decorator';
import { APPLICATION_TITLE_MIN_LENGTH, APPLICATION_TITLE_MAX_LENGTH } from '../constants';

export class UpdateApplicationTitleDto {
  @ApiProperty({
    description: 'Custom application title (user editable)',
    example: 'Senior Frontend Developer @ Google',
    minLength: APPLICATION_TITLE_MIN_LENGTH,
    maxLength: APPLICATION_TITLE_MAX_LENGTH,
  })
  @IsString()
  @MinLength(APPLICATION_TITLE_MIN_LENGTH, {
    message: `Title must be at least ${APPLICATION_TITLE_MIN_LENGTH} characters long`,
  })
  @MaxLength(APPLICATION_TITLE_MAX_LENGTH, {
    message: `Title must be at most ${APPLICATION_TITLE_MAX_LENGTH} characters long`,
  })
  @Sanitize()
  title: string;
}
