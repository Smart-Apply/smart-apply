import { IsOptional, IsString, IsUrl, ValidateBy, ValidationOptions } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Custom validator to ensure at least one input source is provided
 */
function IsAtLeastOneSource(validationOptions?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isAtLeastOneSource',
      validator: {
        validate: (_value, args) => {
          const object = args?.object as ParseJobPostingDto;
          return !!(object?.text || object?.url || object?.fileId);
        },
        defaultMessage: () => 'At least one input source (text, url, or fileId) is required',
      },
    },
    validationOptions,
  );
}

export class ParseJobPostingDto {
  @ApiPropertyOptional({ description: 'Raw job posting text' })
  @IsOptional()
  @IsString()
  @IsAtLeastOneSource()
  text?: string;

  @ApiPropertyOptional({ description: 'URL to job posting page' })
  @IsOptional()
  @IsUrl()
  url?: string;

  @ApiPropertyOptional({ description: 'Storage key of uploaded file (PDF/DOCX)' })
  @IsOptional()
  @IsString()
  fileId?: string;
}
