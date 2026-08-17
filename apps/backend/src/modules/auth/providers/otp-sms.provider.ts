import { Injectable, Logger } from '@nestjs/common';

/**
 * Stubbed SMS gateway. A real implementation would call an SMS aggregator
 * (e.g. Eskiz.uz, Play Mobile). For now it just logs the code so the flow
 * can be exercised end-to-end in development.
 */
@Injectable()
export class OtpSmsProvider {
  private readonly logger = new Logger(OtpSmsProvider.name);

  send(phone: string, code: string): void {
    this.logger.log(`[STUB SMS] OTP code for ${phone}: ${code}`);
  }
}
