import { UnauthorizedException } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AdminAuthService } from './admin-auth.service';

jest.mock('bcryptjs');

const bcryptCompare = bcrypt.compare as unknown as jest.Mock;

const JWT_CONFIG = {
  accessSecret: 'access-secret',
  refreshSecret: 'refresh-secret',
  accessTtl: '15m',
  refreshTtl: '30d',
};

function buildAdmin(overrides: Record<string, unknown> = {}) {
  return {
    id: 'admin-1',
    username: 'admin',
    passwordHash: 'hashed',
    fullName: 'Bosh administrator',
    email: 'admin@example.com',
    role: AdminRole.SUPER_ADMIN,
    isActive: true,
    lastLoginAt: null,
    ...overrides,
  };
}

function buildDeps() {
  const prisma = {
    adminUser: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    adminRefreshToken: {
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
    },
  };
  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('tok'),
    verifyAsync: jest.fn(),
  };
  const configService = {
    get: jest.fn().mockReturnValue(JWT_CONFIG),
  };
  const service = new AdminAuthService(
    prisma as any,
    jwtService as any,
    configService as any,
  );
  return { service, prisma, jwtService, configService };
}

describe('AdminAuthService', () => {
  beforeEach(() => {
    bcryptCompare.mockReset();
  });

  describe('login', () => {
    it('returns an admin token pair for correct credentials', async () => {
      const { service, prisma, jwtService } = buildDeps();
      prisma.adminUser.findUnique.mockResolvedValue(buildAdmin());
      bcryptCompare.mockResolvedValue(true);

      const result = await service.login({ username: 'admin', password: 'secret' } as any);

      expect(result.accessToken).toBe('tok');
      expect(result.refreshToken).toBe('tok');
      expect(result.expiresIn).toBe(900);
      expect(result.admin).toMatchObject({
        id: 'admin-1',
        username: 'admin',
        role: AdminRole.SUPER_ADMIN,
      });
      // A fresh refresh token row is persisted, lastLoginAt is bumped.
      expect(prisma.adminRefreshToken.create).toHaveBeenCalledTimes(1);
      expect(prisma.adminUser.update).toHaveBeenCalledTimes(1);
      // The signed payload carries the admin scope claim.
      const signedPayload = jwtService.signAsync.mock.calls[0][0];
      expect(signedPayload.scope).toBe('admin');
      expect(signedPayload.sub).toBe('admin-1');
    });

    it('throws Unauthorized when the password is wrong', async () => {
      const { service, prisma } = buildDeps();
      prisma.adminUser.findUnique.mockResolvedValue(buildAdmin());
      bcryptCompare.mockResolvedValue(false);

      await expect(
        service.login({ username: 'admin', password: 'nope' } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.adminRefreshToken.create).not.toHaveBeenCalled();
    });

    it('throws Unauthorized when the admin does not exist', async () => {
      const { service, prisma } = buildDeps();
      prisma.adminUser.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ username: 'ghost', password: 'secret' } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(bcryptCompare).not.toHaveBeenCalled();
    });

    it('throws Unauthorized when the admin is inactive', async () => {
      const { service, prisma } = buildDeps();
      prisma.adminUser.findUnique.mockResolvedValue(buildAdmin({ isActive: false }));

      await expect(
        service.login({ username: 'admin', password: 'secret' } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('throws Unauthorized when the token scope is not admin', async () => {
      const { service, jwtService } = buildDeps();
      jwtService.verifyAsync.mockResolvedValue({ sub: 'admin-1', scope: 'employee' });

      await expect(service.refresh('some-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws Unauthorized when the token cannot be verified', async () => {
      const { service, jwtService } = buildDeps();
      jwtService.verifyAsync.mockRejectedValue(new Error('bad signature'));

      await expect(service.refresh('bad-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rotates the refresh token on the happy path', async () => {
      const { service, prisma, jwtService } = buildDeps();
      jwtService.verifyAsync.mockResolvedValue({ sub: 'admin-1', scope: 'admin' });
      prisma.adminRefreshToken.findFirst.mockResolvedValue({
        id: 'rt-1',
        adminId: 'admin-1',
        revoked: false,
        expiresAt: new Date(Date.now() + 60_000),
      });
      prisma.adminUser.findUnique.mockResolvedValue(buildAdmin());

      const result = await service.refresh('old-refresh-token');

      // Old token revoked, new pair issued + persisted.
      expect(prisma.adminRefreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
        data: { revoked: true },
      });
      expect(prisma.adminRefreshToken.create).toHaveBeenCalledTimes(1);
      expect(result.accessToken).toBe('tok');
      expect(result.refreshToken).toBe('tok');
      const signedPayload = jwtService.signAsync.mock.calls[0][0];
      expect(signedPayload.scope).toBe('admin');
    });

    it('throws Unauthorized when the stored token is revoked/missing', async () => {
      const { service, prisma, jwtService } = buildDeps();
      jwtService.verifyAsync.mockResolvedValue({ sub: 'admin-1', scope: 'admin' });
      prisma.adminRefreshToken.findFirst.mockResolvedValue(null);

      await expect(service.refresh('old-refresh-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.adminRefreshToken.update).not.toHaveBeenCalled();
    });
  });
});
