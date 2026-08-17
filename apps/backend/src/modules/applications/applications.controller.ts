import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Application, ApplicationMessage, Attachment, EmployeeRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
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
}
