import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApplicationFileDto {
  @ApiProperty({ example: 'applications/app-123-cover-letter.pdf' })
  key: string;

  @ApiProperty({ example: 'cover-letter.pdf' })
  filename: string;

  @ApiProperty({ example: 'application/pdf' })
  mimeType: string;

  @ApiProperty({
    example: 'https://storage.azure.com/...?sv=2021-12-02&se=...',
    description: 'Download URL (SAS Token für Azure, Pre-signed URL für S3)',
  })
  url: string;

  @ApiProperty({
    example: '2024-01-15T11:30:00Z',
    description: 'URL Ablaufzeit',
  })
  expiresAt: Date;
}

export class ApplicationFilesResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  applicationId: string;

  @ApiPropertyOptional({ type: ApplicationFileDto })
  coverLetter?: ApplicationFileDto;

  @ApiPropertyOptional({ type: ApplicationFileDto })
  resume?: ApplicationFileDto;
}
