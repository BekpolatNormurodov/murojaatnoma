import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Application, ApplicationMessage, Attachment, AttachmentType, EmployeeRole } from '@prisma/client';
import { AppConfig } from '../../common/config/configuration';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AllowCitizen } from '../../common/decorators/allow-citizen.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { Paginated } from '../../common/interfaces/paginated.interface';
import { ApplicationsService } from './applications.service';
import { AssignApplicationDto } from './dto/assign-application.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { ListApplicationsQueryDto } from './dto/list-applications-query.dto';
import { ReplyApplicationDto } from './dto/reply-application.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';
import { ApplicationEventWithNames } from './interfaces/application-event-with-names.interface';

/**
 * Infers the Attachment `type` from an uploaded file's mimetype.
 *
 * NOTE: prisma/schema.prisma `enum AttachmentType` currently only defines
 * PHOTO and VIDEO (no VOICE/AUDIO/DOCUMENT value). Until that enum is
 * extended, voice/audio recordings are stored as VIDEO — the closer of the
 * two existing values, since both are time-based recorded media rather than
 * a static image. Revisit once a dedicated VOICE value is added.
 */
function inferAttachmentType(mimetype: string): AttachmentType {
  if (mimetype.startsWith('image/')) return AttachmentType.PHOTO;
  if (mimetype.startsWith('video/')) return AttachmentType.VIDEO;
  if (mimetype.startsWith('audio/')) return AttachmentType.VIDEO;
  throw new BadRequestException(`Unsupported file type: ${mimetype}`);
}

@ApiTags('applications')
@Controller('applications')
export class ApplicationsController {
  constructor(
    private readonly applicationsService: ApplicationsService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  @Public()
  @Post()
  @ApiOperation({ summary: 'Submit a new citizen application/complaint (Murojaat)' })
  create(@Body() dto: CreateApplicationDto): Promise<Application> {
    return this.applicationsService.create(dto);
  }

  @ApiBearerAuth()
  @AllowCitizen()
  @Get()
  @ApiOperation({
    summary: 'List applications (staff: all; CITIZEN: scoped to their own phone)',
  })
  findAll(
    @Query() query: ListApplicationsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Paginated<Application>> {
    return this.applicationsService.findAll(query, user);
  }

  @ApiBearerAuth()
  @AllowCitizen()
  @Get(':id')
  @ApiOperation({ summary: 'Get a single application (CITIZEN: own only, else 403)' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Application> {
    return this.applicationsService.findOne(id, user);
  }

  @ApiBearerAuth()
  @Patch(':id/status')
  @ApiOperation({
    summary: 'Transition application status (new -> in_progress -> resolved/rejected)',
  })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Application> {
    return this.applicationsService.updateStatus(id, dto, user.employeeId);
  }

  @ApiBearerAuth()
  @Post(':id/assign')
  @Roles(EmployeeRole.ADMIN, EmployeeRole.EMPLOYEE)
  @ApiOperation({
    summary:
      "Route/forward an application to an employee and/or department (aylantirish); notifies the assignee",
  })
  assign(
    @Param('id') id: string,
    @Body() dto: AssignApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Application> {
    return this.applicationsService.assign(id, dto, user.employeeId);
  }

  @ApiBearerAuth()
  @Get(':id/events')
  @Roles(EmployeeRole.ADMIN, EmployeeRole.EMPLOYEE)
  @ApiOperation({ summary: 'Ordered audit history (created/status/assigned/message events)' })
  findEvents(@Param('id') id: string): Promise<ApplicationEventWithNames[]> {
    return this.applicationsService.findEvents(id);
  }

  @ApiBearerAuth()
  @Post(':id/reply')
  @Roles(EmployeeRole.ADMIN, EmployeeRole.EMPLOYEE)
  @ApiOperation({
    summary: 'Staff reply on an application; auto-advances NEW -> IN_PROGRESS on first reply',
  })
  reply(
    @Param('id') id: string,
    @Body() dto: ReplyApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApplicationMessage> {
    return this.applicationsService.reply(id, dto, user);
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

  @Public()
  @Post(':id/attachments/upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary:
      'Upload a device-local photo/video/voice file (multipart) and attach it to an application. ' +
      'Field name "file", max 25MB, image/video/audio mimetypes only. ' +
      'For pre-hosted media, use POST /applications/:id/attachments instead.',
  })
  async uploadAttachment(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<Attachment> {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    const { publicBaseUrl } = this.configService.get('uploads', { infer: true });
    const type = inferAttachmentType(file.mimetype);
    const url = `${publicBaseUrl}/uploads/${file.filename}`;

    return this.applicationsService.createUploadedAttachment(id, {
      type,
      url,
      fileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    });
  }
}
