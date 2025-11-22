import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CoverLetterDto {
  @ApiPropertyOptional({
    description: 'Freitext-Hinweise für die KI (z. B. Fokus, Tonalität)',
    example: 'Betone Projekterfahrung mit Azure AI',
  })
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional({
    description: 'Manuell bearbeiteter HTML-Inhalt des Anschreibens',
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description: 'Erzwinge neue Generierung über die KI, selbst wenn content gesetzt ist',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  regenerate?: boolean;
}
