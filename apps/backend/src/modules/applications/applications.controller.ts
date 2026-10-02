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
import { optimizeImageUpload } from '../../common/media/image-optimizer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AllowCitizen } from '../../common/decorators/allow-citizen.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { Paginated } from '../../common/interfaces/paginated.interface';
import { ApplicationStats, ApplicationsService } from './applications.service';
import { RateApplicationDto, ReopenApplicationDto } from './dto/feedback-application.dto';
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
  @Get('stats')
  @ApiOperation({ summary: 'Murojaat pipeline stats: status, SLA overdue, resolution time, ratings, per-employee' })
  stats(): Promise<ApplicationStats> {
    return this.applicationsService.stats();
  }

  // Declared before `:id` so "face" is not taken for an application id.
  @ApiBearerAuth()
  @AllowCitizen()
  @Get('face')
  @ApiOperation({ summary: "The citizen's face on file (null until enrolled)" })
  myFace(@CurrentUser() user: AuthenticatedUser): Promise<{ photoUrl: string | null }> {
    return this.applicationsService.citizenFace(user);
  }

  @ApiBearerAuth()
  @AllowCitizen()
  @Post('face')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({
    summary:
      "Store the citizen's face (taken at face enrollment). Every murojaat they file is " +
      'stamped with it, so staff see who wrote it.',
  })
  async saveFace(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ photoUrl: string }> {
    if (!file || !file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Rasm fayli kerak (file)');
    }
    await optimizeImageUpload(file.path, file.mimetype);
    const { publicBaseUrl } = this.configService.get('uploads', { infer: true });
    return this.applicationsService.saveCitizenFace(user, `${publicBaseUrl}/uploads/${file.filename}`);
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
  @AllowCitizen()
  @Get(':id/events')
  @ApiOperation({
    summary: 'Ordered audit history (created/status/assigned/message events; CITIZEN: own only)',
  })
  findEvents(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApplicationEventWithNames[]> {
    return this.applicationsService.findEvents(id, user);
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

  // Thread + attachments: authenticated. A CITIZEN only on their own murojaat
  // (phone in token), staff on any. Were @Public — anyone could read every
  // citizen's thread and post "as the employee".

  @ApiBearerAuth()
  @AllowCitizen()
  @Post(':id/messages')
  @ApiOperation({ summary: 'Post a message on the murojaat thread (role from token)' })
  addMessage(
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApplicationMessage> {
    return this.applicationsService.addMessage(id, dto, user);
  }

  @ApiBearerAuth()
  @AllowCitizen()
  @Get(':id/messages')
  @ApiOperation({ summary: 'List messages of a murojaat (CITIZEN: own only)' })
  findMessages(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApplicationMessage[]> {
    return this.applicationsService.findMessages(id, user);
  }

  @ApiBearerAuth()
  @AllowCitizen()
  @Post(':id/attachments')
  @ApiOperation({ summary: 'Attach a pre-hosted photo/video URL to a murojaat' })
  addAttachment(
    @Param('id') id: string,
    @Body() dto: CreateAttachmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Attachment> {
    return this.applicationsService.addAttachment(id, dto, user);
  }

  @ApiBearerAuth()
  @AllowCitizen()
  @Get(':id/attachments')
  @ApiOperation({ summary: 'List attachments of a murojaat (CITIZEN: own only)' })
  findAttachments(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Attachment[]> {
    return this.applicationsService.findAttachments(id, user);
  }

  @ApiBearerAuth()
  @AllowCitizen()
  @Post(':id/rate')
  @ApiOperation({ summary: 'Citizen rates their RESOLVED murojaat 1..5' })
  rate(
    @Param('id') id: string,
    @Body() dto: RateApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Application> {
    return this.applicationsService.rate(id, user, dto.rating, dto.comment);
  }

  @ApiBearerAuth()
  @AllowCitizen()
  @Post(':id/reopen')
  @ApiOperation({ summary: "Citizen reopens a RESOLVED murojaat (muammo hal bo'lmadi)" })
  reopen(
    @Param('id') id: string,
    @Body() dto: ReopenApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Application> {
    return this.applicationsService.reopen(id, user, dto.reason);
  }

  @ApiBearerAuth()
  @AllowCitizen()
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
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Attachment> {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    const optimized = await optimizeImageUpload(file.path, file.mimetype);
    const { publicBaseUrl } = this.configService.get('uploads', { infer: true });
    const type = inferAttachmentType(file.mimetype);
    const url = `${publicBaseUrl}/uploads/${file.filename}`;

    return this.applicationsService.createUploadedAttachment(id, {
      type,
      url,
      fileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: optimized ?? file.size,
    }, user);
  }
}
