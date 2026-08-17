import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushProvider } from './providers/push.provider';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, PushProvider],
  exports: [NotificationsService],
})
export class NotificationsModule {}
