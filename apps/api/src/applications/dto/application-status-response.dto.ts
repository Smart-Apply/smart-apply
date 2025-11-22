import { ApiProperty } from '@nestjs/swagger';

export class ApplicationStatusResponseDto {
  @ApiProperty({
    description: 'Application ID',
    example: 'clx123456789',
  })
  id: string;

  @ApiProperty({
    description: 'Current status of the application',
    enum: ['PENDING', 'GENERATING', 'READY', 'FAILED'],
    example: 'READY',
  })
  status: string;

  @ApiProperty({
    description: 'Error message if status is FAILED',
    example: null,
    nullable: true,
  })
  errorMessage: string | null;

  @ApiProperty({
    description: 'Timestamp when application was last updated',
    example: '2025-11-22T15:21:34.000Z',
  })
  updatedAt: Date;
}
