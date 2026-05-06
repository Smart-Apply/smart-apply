import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MailboxConnectionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ['MICROSOFT', 'GOOGLE'] })
  provider!: 'MICROSOFT' | 'GOOGLE';

  @ApiProperty({ enum: ['ACTIVE', 'DISABLED', 'ERROR'] })
  status!: 'ACTIVE' | 'DISABLED' | 'ERROR';

  @ApiProperty({ description: 'Email address of the connected mailbox' })
  emailAddress!: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  lastSyncedAt?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  lastErrorMessage?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  subscriptionExpiresAt?: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class ConnectMailboxResponseDto {
  @ApiProperty({ description: 'Redirect the browser to this URL to start the OAuth flow.' })
  authorizationUrl!: string;
}
