import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AdminRole, AdminUser, EmployeeRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { AppConfig } from '../../common/config/configuration';
import { JwtPayload } from '../../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AdminLoginDto } from './dto/admin-login.dto';

export interface AdminProfile {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  role: AdminRole;
}

export interface AdminTokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  admin: AdminProfile;
}

/**
 * Web-admin authentication — separate from the mobile employee OTP flow.
 * Issues the same-format access/refresh JWTs but with a `scope: 'admin'`
 * claim so guards (`@RequireScope('admin')`) can gate the admin surface.
 */
@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async login(dto: AdminLoginDto): Promise<AdminTokenPair> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { username: dto.username.trim() },
    });
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Login yoki parol xato');
    }
    const passwordOk = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Login yoki parol xato');
    }
    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });
    this.logger.log(`Admin login: ${admin.username}`);
    return this.issueTokenPair(admin);
  }

  async refresh(refreshToken: string): Promise<AdminTokenPair> {
    const { refreshSecret } = this.configService.get('jwt', { infer: true });

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (payload.scope !== 'admin') {
      throw new UnauthorizedException('Not an admin refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.adminRefreshToken.findFirst({
      where: { adminId: payload.sub, tokenHash, revoked: false },
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is no longer valid');
    }

    await this.prisma.adminRefreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    });

    const admin = await this.prisma.adminUser.findUnique({ where: { id: payload.sub } });
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Admin account is not active');
    }
    return this.issueTokenPair(admin);
  }

  async me(adminId: string): Promise<AdminProfile & { lastLoginAt: Date | null }> {
    const admin = await this.prisma.adminUser.findUnique({ where: { id: adminId } });
    if (!admin) {
      throw new UnauthorizedException('Admin account not found');
    }
    return {
      id: admin.id,
      username: admin.username,
      fullName: admin.fullName,
      email: admin.email,
      role: admin.role,
      lastLoginAt: admin.lastLoginAt,
    };
  }

  private async issueTokenPair(admin: AdminUser): Promise<AdminTokenPair> {
    const { accessSecret, refreshSecret, accessTtl, refreshTtl } = this.configService.get(
      'jwt',
      { infer: true },
    );

    const payload: JwtPayload = {
      sub: admin.id,
      phone: '',
      role: EmployeeRole.ADMIN,
      scope: 'admin',
      adminRole: admin.role,
      username: admin.username,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: this.ttlToSeconds(accessTtl),
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: this.ttlToSeconds(refreshTtl),
      }),
    ]);

    await this.prisma.adminRefreshToken.create({
      data: {
        adminId: admin.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + this.ttlToSeconds(refreshTtl) * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.ttlToSeconds(accessTtl),
      admin: {
        id: admin.id,
        username: admin.username,
        fullName: admin.fullName,
        email: admin.email,
        role: admin.role,
      },
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private ttlToSeconds(duration: string): number {
    const match = /^(\d+)(s|m|h|d)$/.exec(duration.trim());
    if (!match) {
      return 900;
    }
    const unit: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return parseInt(match[1], 10) * unit[match[2]];
  }
}
