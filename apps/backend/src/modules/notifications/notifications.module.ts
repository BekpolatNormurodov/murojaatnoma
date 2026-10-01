import { Module } from '@nestjs/common';
import { InboxController } from './inbox.controller';
import { NotificationCenter } from './notification-center.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

// Push delivery now lives in the global PushModule (FcmService + PushService),
// so no local push provider is registered here.
@Module({
  // InboxController first: its 'citizen' / 'admin/…' paths must win over
  // NotificationsController's ':id' style routes.
  controllers: [InboxController, NotificationsController],
  providers: [NotificationsService, NotificationCenter],
  exports: [NotificationsService, NotificationCenter],
})
export class NotificationsModule {}
