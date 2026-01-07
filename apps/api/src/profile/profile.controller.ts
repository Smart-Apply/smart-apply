import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { Request } from 'express';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { ResumeParserService } from '../resume-parser/resume-parser.service';
import { ExtractedProfileDto } from '../resume-parser/dto/extracted-profile.dto';

@ApiTags('profile')
@Controller('profile')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@SkipThrottle() // Profile is called frequently, skip rate limiting
export class ProfileController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly resumeParserService: ResumeParserService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved successfully',
    type: ProfileResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async getProfile(@CurrentUser('id') userId: string): Promise<ProfileResponseDto> {
    return this.profileService.getProfile(userId);
  }

  @Put()
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    type: ProfileResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
    @Req() req: Request,
  ): Promise<ProfileResponseDto> {
    return this.profileService.updateProfile(userId, dto, req);
  }

  @Post('parse-resume')
  @SkipThrottle({ default: true }) // Skip default throttle
  @Throttle({ 'resume-parser': {} }) // Apply resume-parser throttle (10/hour)
  @UseInterceptors(FileInterceptor('file', { storage: undefined })) // Memory storage only
  @ApiOperation({
    summary: 'Parse resume file and extract profile data',
    description:
      'Upload a PDF or DOCX resume file to extract structured profile data using AI. Rate limited to 10 uploads per hour.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Resume file (PDF or DOCX, max 10MB)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Resume parsed successfully',
    type: ExtractedProfileDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file type, size exceeds limit, or parsing failed',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded - max 10 resume parses per hour',
  })
  async parseResume(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: 10 * 1024 * 1024, // 10MB
            message:
              'Die Datei ist zu groß. Bitte laden Sie eine Datei mit maximal 10 MB hoch.',
          }),
          new FileTypeValidator({
            fileType: /(pdf|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/,
          }),
        ],
        fileIsRequired: true,
        errorHttpStatusCode: 400,
      }),
    )
    file: Express.Multer.File,
  ): Promise<ExtractedProfileDto> {
    return this.resumeParserService.parseResume(file.buffer, file.mimetype);
  }
}
