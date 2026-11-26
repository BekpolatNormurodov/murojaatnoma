import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AppConfig } from '../../common/config/configuration';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthService } from './auth.service';
import { OtpSmsProvider } from './providers/otp-sms.provider';

type Row = Record<string, unknown> & {
  tokenHash: string;
  revoked: boolean;
  expiresAt: Date;
};

/** Just enough of a Prisma token table: create + updateMany with equality filters. */
function table() {
  const rows: Row[] = [];
  return {
    rows,
    create: jest.fn(({ data }: { data: Row }) => {
      rows.push({ ...data, revoked: false });
      return Promise.resolve(data);
    }),
    findFirst: jest.fn(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(
        rows.find((r) =>
          Object.entries(where).every(([k, v]) =>
            k === 'expiresAt' ? r.expiresAt > (v as { gt: Date }).gt : r[k] === v,
          ),
        ) ?? null,
      ),
    ),
    updateMany: jest.fn(
      ({ where, data }: { where: Record<string, unknown>; data: Partial<Row> }) => {
        const hit = rows.filter((r) =>
          Object.entries(where).every(([k, v]) =>
            k === 'expiresAt' ? r.expiresAt > (v as { gt: Date }).gt : r[k] === v,
          ),
        );
        hit.forEach((r) => Object.assign(r, data));
        return Promise.resolve({ count: hit.length });
      },
    ),
  };
}

function build() {
  const employee = { id: 'e1', phone: '+998900000001', role: 'EMPLOYEE', isActive: true };
  const refreshToken = table();
  const citizenRefreshToken = table();
  const prisma = {
    refreshToken,
    citizenRefreshToken,
    employee: { findUnique: jest.fn(() => Promise.resolve(employee)) },
    otpChallenge: {
      findFirst: jest.fn(() =>
        Promise.resolve({
          id: 'c1',
          code: '123456',
          attempts: 0,
          expiresAt: new Date(Date.now() + 60_000),
        }),
      ),
      update: jest.fn(() => Promise.resolve({})),
    },
  };
  const secrets = {
    accessSecret: 'a',
    refreshSecret: 'r',
    accessTtl: '15m',
    refreshTtl: '30d',
  };
  const config = { get: () => secrets } as unknown as ConfigService<AppConfig, true>;
  const jwt = new JwtService({});
  const svc = new AuthService(
    prisma as unknown as PrismaService,
    jwt,
    config,
    {} as OtpSmsProvider,
  );
  const claims = (t: string) => jwt.decode<Record<string, unknown>>(t);
  const signIn = () => svc.verifyOtp({ phone: '+998901112233', code: '123456' });
  const asEmployee = async () => {
    const issue = svc as unknown as {
      issueTokenPair: (p: object) => ReturnType<AuthService['verifyOtp']>;
    };
    return issue.issueTokenPair({
      sub: 'e1',
      phone: employee.phone,
      role: 'EMPLOYEE',
      scope: 'employee',
    });
  };
  return { svc, employee, claims, signIn, asEmployee, refreshToken, citizenRefreshToken };
}

describe('AuthService.refresh', () => {
  it('renews a citizen session and keeps it a citizen one', async () => {
    const { svc, claims, signIn, refreshToken } = build();
    const first = await signIn();
    const second = await svc.refresh(first.refreshToken);
    expect(claims(second.accessToken)).toMatchObject({
      sub: '+998901112233',
      phone: '+998901112233',
      role: 'CITIZEN',
      scope: 'citizen',
    });
    // …and again, with the token the refresh returned.
    await expect(svc.refresh(second.refreshToken)).resolves.toHaveProperty('accessToken');
    expect(refreshToken.rows).toHaveLength(0);
  });

  it('spends a refresh token only once', async () => {
    const { svc, signIn } = build();
    const { refreshToken } = await signIn();
    await svc.refresh(refreshToken);
    await expect(svc.refresh(refreshToken)).rejects.toThrow(UnauthorizedException);
  });

  it('refuses a citizen token after logout', async () => {
    const { svc, signIn } = build();
    const { refreshToken } = await signIn();
    await svc.logout(refreshToken);
    await expect(svc.refresh(refreshToken)).rejects.toThrow(UnauthorizedException);
  });

  it('refuses a signed token that was never stored', async () => {
    const { svc, signIn, citizenRefreshToken } = build();
    const { refreshToken } = await signIn();
    citizenRefreshToken.rows.length = 0;
    await expect(svc.refresh(refreshToken)).rejects.toThrow(UnauthorizedException);
  });

  it('renews an employee with the current role', async () => {
    const { svc, claims, asEmployee, employee } = build();
    const pair = await asEmployee();
    employee.role = 'ADMIN';
    const next = await svc.refresh(pair.refreshToken);
    expect(claims(next.accessToken)).toMatchObject({
      sub: 'e1',
      role: 'ADMIN',
      scope: 'employee',
    });
  });

  it('refuses a deactivated employee', async () => {
    const { svc, asEmployee, employee } = build();
    const pair = await asEmployee();
    employee.isActive = false;
    await expect(svc.refresh(pair.refreshToken)).rejects.toThrow(UnauthorizedException);
  });
});
