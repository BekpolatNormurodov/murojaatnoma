import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Request, Response } from 'express';
import { Observable, from, of, lastValueFrom } from 'rxjs';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/** How long a completed write is remembered for replay. */
const TTL_MS = 15 * 60 * 1000;
/** Upper bound on remembered keys (oldest evicted first). */
const MAX_ENTRIES = 5000;
/** Bodies bigger than this are not cached for replay (still de-duplicated while in flight). */
const MAX_BODY_CHARS = 256 * 1024;

interface Entry {
  expiresAt: number;
  /** Set while the first request is still executing. */
  pending?: Promise<unknown>;
  status?: number;
  body?: unknown;
}

/**
 * Idempotent writes for flaky mobile networks.
 *
 * The mobile apps attach an `Idempotency-Key` header to every POST/PUT/PATCH/
 * DELETE and RETRY a write when the connection drops mid-request — at which
 * point the server may already have executed it (the response just never
 * reached the phone). Without this, a retry on a weak 3G link creates a second
 * murojaat / chat message / check-in.
 *
 * Same (principal, method, path, key) within 15 min:
 *  - first request still running → the duplicate waits for and gets its result;
 *  - first request finished OK   → the stored status + body are replayed;
 *  - first request failed        → nothing is stored, the retry executes anew.
 *
 * In-memory (single backend instance); requests without the header are untouched.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);
  private readonly entries = new Map<string, Entry>();

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: AuthenticatedUser }>();
    const res = http.getResponse<Response>();

    const method = req.method.toUpperCase();
    const rawKey = req.header('idempotency-key');
    if (!rawKey || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }
    const key = rawKey.trim().slice(0, 128);
    if (!key) return next.handle();

    // Public token endpoints (/auth/refresh) have no req.user and a phone's IP
    // changes between retries (cell handover) — key them by the refresh token
    // itself, so a retried refresh whose first response was lost replays the
    // SAME new pair instead of failing on the already-rotated token (which
    // used to log users out on weak networks).
    const bodyToken = (req.body as { refreshToken?: unknown } | undefined)?.refreshToken;
    const principal =
      req.user?.employeeId ??
      (typeof bodyToken === 'string' && bodyToken
        ? `rt:${createHash('sha256').update(bodyToken).digest('hex').slice(0, 24)}`
        : (req.ip ?? 'anon'));
    const id = `${principal}|${method}|${req.originalUrl.split('?')[0]}|${key}`;
    const now = Date.now();
    this.sweep(now);

    const existing = this.entries.get(id);
    if (existing && existing.expiresAt > now) {
      if (existing.pending) {
        this.logger.debug(`replay (in-flight) ${method} ${req.originalUrl}`);
        return from(existing.pending);
      }
      if (existing.status !== undefined) {
        this.logger.debug(`replay (stored) ${method} ${req.originalUrl}`);
        res.status(existing.status);
        res.setHeader('Idempotent-Replayed', 'true');
        return of(existing.body);
      }
    }

    const entry: Entry = { expiresAt: now + TTL_MS };
    const pending = lastValueFrom(next.handle(), { defaultValue: undefined }).then(
      (body) => {
        entry.pending = undefined;
        if (safeSize(body) <= MAX_BODY_CHARS) {
          entry.status = res.statusCode;
          entry.body = body;
        } else {
          this.entries.delete(id);
        }
        return body;
      },
      (err: unknown) => {
        // Failed writes are not remembered — the client's retry runs again.
        this.entries.delete(id);
        throw err;
      },
    );
    entry.pending = pending;
    this.entries.set(id, entry);
    return from(pending);
  }

  private sweep(now: number): void {
    if (this.entries.size < MAX_ENTRIES) {
      // Cheap path: drop only expired entries occasionally.
      if (Math.random() > 0.02) return;
    }
    for (const [k, e] of this.entries) {
      if (e.expiresAt <= now && !e.pending) this.entries.delete(k);
    }
    while (this.entries.size >= MAX_ENTRIES) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}

function safeSize(body: unknown): number {
  if (body === undefined || body === null) return 0;
  try {
    return JSON.stringify(body).length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}
