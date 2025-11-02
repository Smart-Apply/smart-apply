import { ApiProperty } from '@nestjs/swagger';

export class UploadResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the upload',
    example: 'clx1234567890abcdef',
  })
  id: string;

  @ApiProperty({
    description: 'Original filename',
    example: 'resume.pdf',
  })
  fileName: string;

  @ApiProperty({
    description: 'MIME type of the file',
    example: 'application/pdf',
  })
  mimeType: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 1048576,
  })
  size: number;

  @ApiProperty({
    description: 'Storage key/path for the file',
    example: 'user123/1234567890-resume.pdf',
  })
  storageKey: string;

  @ApiProperty({
    description: 'Upload timestamp',
    example: '2025-01-15T10:30:00.000Z',
  })
  uploadedAt: Date;
}
