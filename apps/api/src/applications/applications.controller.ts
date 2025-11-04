import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  UseGuards,
  ParseBoolPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ApplicationResponseDto } from './dto/application-response.dto';
import { ApplicationFilesResponseDto } from './dto/application-files-response.dto';

@ApiTags('applications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new application',
    description:
      'Creates a new application and triggers background processing (LLM → PDF → Storage)',
  })
  @ApiResponse({
    status: 201,
    description: 'Application created successfully',
    type: ApplicationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request (missing profile or invalid job posting)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @CurrentUser() user: any,
    @Body() dto: CreateApplicationDto,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all applications',
    description: 'Returns all applications for the authenticated user',
  })
  @ApiQuery({
    name: 'includeJobPosting',
    required: false,
    type: Boolean,
    description: 'Include job posting details in response',
  })
  @ApiResponse({
    status: 200,
    description: 'Applications retrieved successfully',
    type: [ApplicationResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @CurrentUser() user: any,
    @Query('includeJobPosting', new ParseBoolPipe({ optional: true }))
    includeJobPosting = false,
  ): Promise<ApplicationResponseDto[]> {
    return this.applicationsService.findAll(user.sub, includeJobPosting);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get application by ID',
    description: 'Returns a single application with details',
  })
  @ApiQuery({
    name: 'includeJobPosting',
    required: false,
    type: Boolean,
    description: 'Include job posting details in response',
  })
  @ApiResponse({
    status: 200,
    description: 'Application retrieved successfully',
    type: ApplicationResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async findOne(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Query('includeJobPosting', new ParseBoolPipe({ optional: true }))
    includeJobPosting = false,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.findOne(user.sub, id, includeJobPosting);
  }

  @Get(':id/files')
  @ApiOperation({
    summary: 'Get download URLs for application files',
    description: 'Returns SAS URLs for cover letter and resume PDFs (1 hour expiry)',
  })
  @ApiResponse({
    status: 200,
    description: 'File URLs retrieved successfully',
    type: ApplicationFilesResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Application not ready' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async getFiles(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<ApplicationFilesResponseDto> {
    return this.applicationsService.getFiles(user.sub, id);
  }
}
