import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { AppConfig } from '../../common/config/configuration';

/** Shape of a Google service-account JSON (snake_case, as downloaded from the
 * Firebase console). `admin.credential.cert()` reads these fields at runtime. */
interface ServiceAccountJson {
  project_id?: string;
  client_email?: string;
  private_key?: string;
}

/**
 * Thin wrapper over the Firebase Admin SDK that actually delivers push
 * notifications via Firebase Cloud Messaging (FCM).
 *
 * Credentials are supplied out-of-band as a base64-encoded service-account
 * JSON in `FIREBASE_SERVICE_ACCOUNT_B64` (kept only in the server's gitignored
 * .env — never committed, since the repo is public). When the variable is
 * absent the service stays DISABLED: `enabled` is false and callers fall back
 * to logging, so the app boots and runs perfectly fine without Firebase.
 */
@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private app: admin.app.App | null = null;

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  onModuleInit(): void {
    const fb = this.config.get('firebase', { infer: true });
    if (!fb.serviceAccountB64) {
      this.logger.warn(
        'FIREBASE_SERVICE_ACCOUNT_B64 not set — push notifications DISABLED (payloads are logged only).',
      );
      return;
    }
    try {
      const raw = Buffer.from(fb.serviceAccountB64, 'base64').toString('utf8');
      const parsed = JSON.parse(raw) as ServiceAccountJson;
      this.app = admin.initializeApp(
        { credential: admin.credential.cert(parsed as admin.ServiceAccount) },
        'push',
      );
      this.logger.log(
        `FCM initialized for project "${parsed.project_id ?? fb.projectId}" — push notifications ENABLED.`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to initialize FCM (push stays disabled): ${(err as Error).message}`,
      );
      this.app = null;
    }
  }

  /** Whether a Firebase app was successfully initialized. */
  get enabled(): boolean {
    return this.app !== null;
  }

  /**
   * Deliver one notification to a set of device tokens. Best-effort: never
   * throws. Returns the tokens FCM reported as permanently invalid so the
   * caller can prune them from the database.
   */
  async sendToTokens(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<string[]> {
    if (!this.app || tokens.length === 0) {
      return [];
    }
    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: { title, body },
      data,
      android: {
        priority: 'high',
        notification: { channelId: 'hokimiyat_default', sound: 'default' },
      },
      apns: { payload: { aps: { sound: 'default' } } },
    };
    try {
      const res = await admin.messaging(this.app).sendEachForMulticast(message);
      const invalid: string[] = [];
      res.responses.forEach((r, i) => {
        if (!r.success) {
          const code = r.error?.code ?? '';
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/invalid-argument'
          ) {
            invalid.push(tokens[i]);
          }
        }
      });
      if (res.failureCount > 0) {
        this.logger.debug(
          `FCM sent ${res.successCount}/${tokens.length}, ${invalid.length} token(s) to prune`,
        );
      }
      return invalid;
    } catch (err) {
      this.logger.error(`FCM multicast send failed: ${(err as Error).message}`);
      return [];
    }
  }
}
