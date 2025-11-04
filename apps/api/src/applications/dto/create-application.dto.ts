import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApplicationDto {
  @ApiProperty({
    description: 'ID des Job Postings',
    example: 'cmhkpp7xr000he752e3o5s8ut',
  })
  @IsString()
  @IsNotEmpty()
  jobPostingId: string;

  @ApiPropertyOptional({
    description: 'Optionale Notizen zur Bewerbung',
    example: 'Kontakt über Networking Event',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
