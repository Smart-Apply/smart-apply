import { IsString, IsEnum, IsOptional, IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TemplateType } from '@prisma/client';

export class CreateTemplateDto {
  @ApiProperty({ example: 'Professional Cover Letter' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'Classic, formal layout suitable for corporate applications',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: TemplateType, example: TemplateType.COVER_LETTER })
  @IsEnum(TemplateType)
  type: TemplateType;

  @ApiProperty({ example: 'Professional' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({
    example: 'https://storage.example.com/thumbnails/professional-cover-letter.png',
    required: false,
  })
  @IsString()
  @IsOptional()
  thumbnailUrl?: string;

  @ApiProperty({ description: 'Handlebars HTML template' })
  @IsString()
  @IsNotEmpty()
  htmlTemplate: string;

  @ApiProperty({ description: 'CSS styles for the template' })
  @IsString()
  @IsNotEmpty()
  cssStyles: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ example: false, required: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
