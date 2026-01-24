import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ApplicationTrackingStatus } from '../../generated/prisma/client';

export class UpdateApplicationStatusDto {
  @ApiProperty({
    enum: ApplicationTrackingStatus,
    description: 'User-facing application tracking status',
    example: ApplicationTrackingStatus.INTERVIEW,
  })
  @IsEnum(ApplicationTrackingStatus, {
    message: 'Status must be one of: APPLIED, INTERVIEW, ACCEPTED, REJECTED',
  })
  status: ApplicationTrackingStatus;
}
