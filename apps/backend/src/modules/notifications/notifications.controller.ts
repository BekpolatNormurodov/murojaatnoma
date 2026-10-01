import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { Body, Controller, ForbiddenException, Get, Param, Patch, Post } from '@nestjs/common';
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
  @ApiOperation({ summary: 'List notifications for an employee (employees: own only)' })
  findAllForEmployee(
    @Param('employeeId') employeeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Notification[]> {
    // An employee may only read their OWN notifications (was readable for any
    // id by any logged-in user). Admin tokens may read anyone's.
    if (user.scope !== 'admin' && user.employeeId !== employeeId) {
      throw new ForbiddenException("Boshqa xodimning bildirishnomalari yopiq");
    }
    return this.notificationsService.findAllForEmployee(employeeId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read (own only)' })
  markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Notification> {
    return this.notificationsService.markAsRead(
      id,
      user.scope === 'admin' ? undefined : user.employeeId,
    );
  }
}
