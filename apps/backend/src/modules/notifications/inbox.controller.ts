import { Controller, ForbiddenException, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AllowCitizen } from '../../common/decorators/allow-citizen.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireScope } from '../../common/decorators/scope.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Read/mark-read for the admin bell and the citizen inbox. (The admin list
 * itself is GET /notifications in the catalog module; employees use
 * NotificationsController.)
 */
@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class InboxController {
  constructor(private readonly prisma: PrismaService) {}

  @RequireScope('admin')
  @Patch('admin/:id/read')
  @ApiOperation({ summary: "Admin bildirishnomasini o'qilgan qilish" })
  async adminRead(@Param('id') id: string): Promise<{ ok: true }> {
    await this.prisma.adminNotification.updateMany({ where: { id }, data: { read: true } });
    return { ok: true };
  }

  @RequireScope('admin')
  @Post('admin/read-all')
  @ApiOperation({ summary: "Barcha admin bildirishnomalarini o'qilgan qilish" })
  async adminReadAll(): Promise<{ ok: true }> {
    await this.prisma.adminNotification.updateMany({ where: { read: false }, data: { read: true } });
    return { ok: true };
  }

  @AllowCitizen()
  @Get('citizen')
  @ApiOperation({ summary: 'Fuqaroning bildirishnomalari (o‘z telefoni bo‘yicha)' })
  citizenList(@CurrentUser() user: AuthenticatedUser) {
    return this.prisma.citizenNotification.findMany({
      where: { phone: this.citizenPhone(user) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @AllowCitizen()
  @Get('citizen/unread-count')
  async citizenUnread(@CurrentUser() user: AuthenticatedUser): Promise<{ count: number }> {
    const count = await this.prisma.citizenNotification.count({
      where: { phone: this.citizenPhone(user), isRead: false },
    });
    return { count };
  }

  @AllowCitizen()
  @Patch('citizen/:id/read')
  async citizenRead(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<{ ok: true }> {
    await this.prisma.citizenNotification.updateMany({
      where: { id, phone: this.citizenPhone(user) },
      data: { isRead: true },
    });
    return { ok: true };
  }

  @AllowCitizen()
  @Post('citizen/read-all')
  async citizenReadAll(@CurrentUser() user: AuthenticatedUser): Promise<{ ok: true }> {
    await this.prisma.citizenNotification.updateMany({
      where: { phone: this.citizenPhone(user), isRead: false },
      data: { isRead: true },
    });
    return { ok: true };
  }

  private citizenPhone(user: AuthenticatedUser): string {
    if (user?.role !== 'CITIZEN' || !user.phone) {
      throw new ForbiddenException('Faqat fuqaro uchun');
    }
    return user.phone;
  }
}
