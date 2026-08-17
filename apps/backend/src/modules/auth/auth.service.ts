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
import { MeDto } from './dto/me.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { RequestOtpResultDto } from './dto/request-otp-result.dto';
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

  /**
   * Generates and "sends" (stub) a one-time code for the given phone number.
   * `OtpSmsProvider` currently just logs the code — a real SMS aggregator
   * (e.g. Eskiz.uz) will replace it, at which point `devCode` below should
   * be disabled (OTP_DEV_ECHO=false) in every non-development environment.
   */
  async requestOtp(dto: RequestOtpDto): Promise<RequestOtpResultDto> {
    const { ttlSeconds, devEcho } = this.configService.get('otp', { infer: true });
    const code = randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await this.prisma.otpChallenge.create({
      data: { phone: dto.phone, code, expiresAt },
    });

    this.otpSmsProvider.send(dto.phone, code);

    return {
      expiresInSeconds: ttlSeconds,
      // Dev convenience only: lets the login flow be exercised end-to-end
      // without a live SMS gateway. Omitted unless OTP_DEV_ECHO=true.
      ...(devEcho ? { devCode: code } : {}),
    };
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

    // Brute-force lockout: after 5 wrong codes for this challenge, stop
    // accepting attempts — the user must request a fresh OTP.
    if (challenge.attempts >= 5) {
      throw new BadRequestException(
        'Too many incorrect attempts. Request a new code.',
      );
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

    // NOTE: citizen tokens are intentionally NOT issued here yet. A citizen
    // principal reaches every JwtAuthGuard-only route (e.g. GET /employees
    // exposes the staff roster) unless the app is secure-by-default for the
    // 'citizen' scope. That global guard (deny scope:'citizen' unless a route
    // opts in via @AllowCitizen) must land BEFORE re-enabling the citizen
    // branch — see plan A. The PrincipalRole/'citizen' scope types are kept
    // in place for that follow-up.
    return this.issueTokenPair({
      sub: employee.id,
      phone: employee.phone,
      role: employee.role,
      scope: 'employee',
    });
  }

  /** Returns the current employee's profile, derived from the JWT subject. */
  async me(employeeId: string): Promise<MeDto> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { _count: { select: { faceTemplates: true } } },
    });

    if (!employee) {
      throw new UnauthorizedException('Employee not found');
    }

    return {
      id: employee.id,
      fullName: employee.fullName,
      phone: employee.phone,
      position: employee.position,
      region: employee.region,
      district: employee.district,
      role: employee.role,
      avatarUrl: employee.avatarUrl,
      hasFace: employee._count.faceTemplates > 0,
    };
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

    // Strip the decoded token's `iat`/`exp` before re-signing: handing a
    // payload that already carries `exp` together with `expiresIn` makes
    // jsonwebtoken throw ("Bad options.expiresIn ... already has 'exp'"),
    // which broke every refresh. Rebuild a clean claim set instead.
    return this.issueTokenPair({
      sub: payload.sub,
      phone: payload.phone,
      role: payload.role,
    });
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

    // Citizens have no employee row, so a refresh token cannot be persisted
    // (refreshToken.employeeId is a required FK to employee). A citizen simply
    // re-requests an OTP when the short-lived access token expires — acceptable
    // for the citizen flow; long citizen sessions would need a schema change.
    if (payload.role !== 'CITIZEN') {
      await this.prisma.refreshToken.create({
        data: {
          employeeId: payload.sub,
          tokenHash: this.hashToken(refreshToken),
          expiresAt: this.addDuration(refreshTtl),
        },
      });
    }

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
