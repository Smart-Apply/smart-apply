import { ApiProperty } from '@nestjs/swagger';

export enum TemplateType {
  COVER_LETTER = 'COVER_LETTER',
  RESUME = 'RESUME',
  BOTH = 'BOTH',
}

export class TemplateResponseDto {
  @ApiProperty({ example: 'clx1y2z3a4b5c6d7e8f9g0h1' })
  id: string;

  @ApiProperty({ example: 'Professional Cover Letter' })
  name: string;

  @ApiProperty({
    example: 'Classic, formal layout suitable for corporate applications',
    required: false,
  })
  description?: string;

  @ApiProperty({ enum: TemplateType, example: TemplateType.COVER_LETTER })
  type: TemplateType;

  @ApiProperty({ example: 'Professional' })
  category: string;

  @ApiProperty({
    example: 'https://storage.example.com/thumbnails/professional-cover-letter.png',
    required: false,
  })
  thumbnailUrl?: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: false })
  isDefault: boolean;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  updatedAt: Date;
}

export class TemplateWithContentResponseDto extends TemplateResponseDto {
  @ApiProperty({ description: 'Handlebars HTML template' })
  htmlTemplate: string;

  @ApiProperty({ description: 'CSS styles for the template' })
  cssStyles: string;
}
