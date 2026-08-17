import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomInt } from 'node:crypto';
import { AppConfig } from '../../common/config/configuration';
import { JwtPayload } from '../../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { TokenPairDto } from './dto/token-pair.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpSmsProvider } from './providers/otp-sms.provider';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly otpSmsProvider: OtpSmsProvider,
  ) {}

  /** Generates and "sends" (stub) a one-time code for the given phone number. */
  async requestOtp(dto: RequestOtpDto): Promise<{ expiresInSeconds: number }> {
    const { ttlSeconds } = this.configService.get('otp', { infer: true });
    const code = randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await this.prisma.otpChallenge.create({
      data: { phone: dto.phone, code, expiresAt },
    });

    this.otpSmsProvider.send(dto.phone, code);

    return { expiresInSeconds: ttlSeconds };
  }

  /** Verifies the OTP and issues an access/refresh token pair for the matching employee. */
  async verifyOtp(dto: VerifyOtpDto): Promise<TokenPairDto> {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { phone: dto.phone, consumed: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge || challenge.expiresAt < new Date()) {
      throw new BadRequestException('OTP code expired or not found');
    }

    if (challenge.code !== dto.code) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid OTP code');
    }

    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumed: true },
    });

    const employee = await this.prisma.employee.findUnique({
      where: { phone: dto.phone },
    });

    if (!employee || !employee.isActive) {
      throw new UnauthorizedException('No active employee for this phone number');
    }

    return this.issueTokenPair({
      sub: employee.id,
      phone: employee.phone,
      role: employee.role,
    });
  }

  /** Rotates a refresh token: validates it, revokes it, and issues a new pair. */
  async refresh(refreshToken: string): Promise<TokenPairDto> {
    const { refreshSecret } = this.configService.get('jwt', { infer: true });

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await this.prisma.refreshToken.findFirst({
      where: { employeeId: payload.sub, tokenHash, revoked: false },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is no longer valid');
    }

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked: true },
    });

    return this.issueTokenPair(payload);
  }

  private async issueTokenPair(payload: JwtPayload): Promise<TokenPairDto> {
    const { accessSecret, refreshSecret, accessTtl, refreshTtl } = this.configService.get(
      'jwt',
      { infer: true },
    );

    // Convert to seconds ourselves rather than passing the raw "15m"/"30d"
    // strings straight through: @nestjs/jwt's `expiresIn` type only accepts
    // a `number` of seconds or a narrow branded string literal type from
    // `ms`, which a plain `string` from config doesn't satisfy.
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

    await this.prisma.refreshToken.create({
      data: {
        employeeId: payload.sub,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: this.addDuration(refreshTtl),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.ttlToSeconds(accessTtl),
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Converts a zeit/ms-style duration string (e.g. "15m", "30d") to a future Date. */
  private addDuration(duration: string): Date {
    return new Date(Date.now() + this.ttlToSeconds(duration) * 1000);
  }

  private ttlToSeconds(duration: string): number {
    const match = /^(\d+)(s|m|h|d)$/.exec(duration.trim());
    if (!match) {
      this.logger.warn(`Unrecognized TTL format "${duration}", defaulting to 900s`);
      return 900;
    }
    const value = parseInt(match[1], 10);
    const unitSeconds: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };
    return value * unitSeconds[match[2]];
  }
}
