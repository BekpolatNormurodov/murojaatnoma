import { Global, Module } from '@nestjs/common';
import { FcmService } from './fcm.service';
import { PushController } from './push.controller';
import { PushService } from './push.service';

/**
 * Global push module: exposes {@link PushService} (high-level, employee-aware)
 * and {@link FcmService} (low-level FCM transport) to every feature module
 * without re-importing. Marked @Global so the notifications module and the
 * location stale-scan can dispatch push without an import cycle.
 */
@Global()
@Module({
  controllers: [PushController],
  providers: [FcmService, PushService],
  exports: [FcmService, PushService],
})
export class PushModule {}
