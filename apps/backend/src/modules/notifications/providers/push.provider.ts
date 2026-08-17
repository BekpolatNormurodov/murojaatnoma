import { Injectable, Logger } from '@nestjs/common';

/**
 * Stubbed push-notification gateway (e.g. Firebase Cloud Messaging). Logs
 * the payload instead of delivering it so the flow can be exercised without
 * external credentials.
 */
@Injectable()
export class PushProvider {
  private readonly logger = new Logger(PushProvider.name);

  send(employeeId: string, title: string, body: string): void {
    this.logger.log(`[STUB PUSH] -> employee ${employeeId}: ${title} - ${body}`);
  }
}
