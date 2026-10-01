import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, Observable, of, throwError } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';

function ctx(key: string | undefined, method = 'POST', user = 'emp-1') {
  const res = { statusCode: 201, status: jest.fn(), setHeader: jest.fn() };
  const req = {
    method,
    originalUrl: '/chat/my/conversations/group-all/messages',
    ip: '1.2.3.4',
    user: { employeeId: user },
    header: (h: string) => (h === 'idempotency-key' ? key : undefined),
  };
  const context = {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ExecutionContext;
  return { context, res };
}

function handler(fn: () => Observable<unknown>): CallHandler & { calls: number } {
  const h = { calls: 0, handle: () => (h.calls++, fn()) };
  return h;
}

describe('IdempotencyInterceptor', () => {
  it('executes a keyed write once and replays the stored result', async () => {
    const i = new IdempotencyInterceptor();
    const h = handler(() => of({ id: 'm1' }));
    const a = await lastValueFrom(i.intercept(ctx('k1').context, h));
    const second = ctx('k1');
    const b = await lastValueFrom(i.intercept(second.context, h));
    expect(h.calls).toBe(1);
    expect(b).toEqual(a);
    expect(second.res.status).toHaveBeenCalledWith(201);
  });

  it('a duplicate arriving while the first is in flight shares its result', async () => {
    const i = new IdempotencyInterceptor();
    let resolve!: (v: unknown) => void;
    const p = new Promise((r) => (resolve = r));
    const h = handler(() => new Observable((sub) => void p.then((v) => (sub.next(v), sub.complete()))));
    const first = lastValueFrom(i.intercept(ctx('k2').context, h));
    const dup = lastValueFrom(i.intercept(ctx('k2').context, h));
    resolve({ id: 'm2' });
    expect(await first).toEqual({ id: 'm2' });
    expect(await dup).toEqual({ id: 'm2' });
    expect(h.calls).toBe(1);
  });

  it('does not remember failures — the retry executes again', async () => {
    const i = new IdempotencyInterceptor();
    let fail = true;
    const h = handler(() => (fail ? throwError(() => new Error('db down')) : of({ ok: true })));
    await expect(lastValueFrom(i.intercept(ctx('k3').context, h))).rejects.toThrow('db down');
    fail = false;
    expect(await lastValueFrom(i.intercept(ctx('k3').context, h))).toEqual({ ok: true });
    expect(h.calls).toBe(2);
  });

  it('keys are per principal and requests without a key are untouched', async () => {
    const i = new IdempotencyInterceptor();
    const h = handler(() => of({ ok: true }));
    await lastValueFrom(i.intercept(ctx('k4', 'POST', 'a').context, h));
    await lastValueFrom(i.intercept(ctx('k4', 'POST', 'b').context, h));
    await lastValueFrom(i.intercept(ctx(undefined).context, h));
    await lastValueFrom(i.intercept(ctx(undefined).context, h));
    await lastValueFrom(i.intercept(ctx('k5', 'GET').context, h));
    expect(h.calls).toBe(5);
  });
});
