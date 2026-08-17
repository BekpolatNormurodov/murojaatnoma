import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Application, ApplicationMessage, Attachment } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Paginated } from '../../common/interfaces/paginated.interface';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { ListApplicationsQueryDto } from './dto/list-applications-query.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';

@ApiTags('applications')
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Public()
  @Post()
  @ApiOperation({ summary: 'Submit a new citizen application/complaint (Murojaat)' })
  create(@Body() dto: CreateApplicationDto): Promise<Application> {
    return this.applicationsService.create(dto);
  }

  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: 'List applications, optionally filtered by status' })
  findAll(@Query() query: ListApplicationsQueryDto): Promise<Paginated<Application>> {
    return this.applicationsService.findAll(query);
  }

  @ApiBearerAuth()
  @Get(':id')
  @ApiOperation({ summary: 'Get a single application' })
  findOne(@Param('id') id: string): Promise<Application> {
    return this.applicationsService.findOne(id);
  }

  @ApiBearerAuth()
  @Patch(':id/status')
  @ApiOperation({
    summary: 'Transition application status (new -> in_progress -> resolved/rejected)',
  })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto,
  ): Promise<Application> {
    return this.applicationsService.updateStatus(id, dto);
  }

  @Public()
  @Post(':id/messages')
  @ApiOperation({ summary: 'Post a chat message on an application' })
  addMessage(
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
  ): Promise<ApplicationMessage> {
    return this.applicationsService.addMessage(id, dto);
  }

  @Public()
  @Get(':id/messages')
  @ApiOperation({ summary: 'List chat messages for an application' })
  findMessages(@Param('id') id: string): Promise<ApplicationMessage[]> {
    return this.applicationsService.findMessages(id);
  }

  @Public()
  @Post(':id/attachments')
  @ApiOperation({ summary: 'Attach a photo/video to an application' })
  addAttachment(
    @Param('id') id: string,
    @Body() dto: CreateAttachmentDto,
  ): Promise<Attachment> {
    return this.applicationsService.addAttachment(id, dto);
  }

  @Public()
  @Get(':id/attachments')
  @ApiOperation({ summary: 'List attachments for an application' })
  findAttachments(@Param('id') id: string): Promise<Attachment[]> {
    return this.applicationsService.findAttachments(id);
  }
}
