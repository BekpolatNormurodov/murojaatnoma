import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EmployeeRole, Notification } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @Roles(EmployeeRole.ADMIN)
  @ApiOperation({ summary: 'Create a notification for an employee (stubbed push)' })
  create(@Body() dto: CreateNotificationDto): Promise<Notification> {
    return this.notificationsService.create(dto);
  }

  @Get('employee/:employeeId')
  @ApiOperation({ summary: 'List notifications for a given employee' })
  findAllForEmployee(@Param('employeeId') employeeId: string): Promise<Notification[]> {
    return this.notificationsService.findAllForEmployee(employeeId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markAsRead(@Param('id') id: string): Promise<Notification> {
    return this.notificationsService.markAsRead(id);
  }
}
