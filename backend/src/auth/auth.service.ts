import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfig } from '../config/configuration';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface PublicUser {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
}

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function parseDurationToMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) return 30 * 24 * 60 * 60 * 1000; // default 30d
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit]!;
  return value * unitMs;
}

// T023-T026 backing service. Registration/login/refresh/logout all live here so
// auth.controller.ts stays a thin HTTP adapter.
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: PublicUser } & AuthTokens> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, role: 'USER' },
    });

    const tokens = await this.issueTokens(user.id, user.email, user.role);
    return { user: this.toPublicUser(user), ...tokens };
  }

  async login(dto: LoginDto): Promise<{ user: PublicUser } & AuthTokens> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueTokens(user.id, user.email, user.role);
    return { user: this.toPublicUser(user), ...tokens };
  }

  /**
   * Rotates a refresh token: the presented token must be a currently-valid, unrevoked,
   * unexpired RefreshToken row. On success the old row is revoked and a new pair is issued
   * (T025). If a token that was already revoked is presented, that's a reuse signal — every
   * other active refresh token for that user is revoked too (Constitution Principle IV).
   */
  async refresh(presentedToken: string): Promise<AuthTokens> {
    const tokenHash = hashRefreshToken(presentedToken);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (record.revokedAt) {
      // Reuse of an already-rotated token: revoke the whole family defensively.
      await this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(record.user.id, record.user.email, record.user.role);
  }

  async logout(presentedToken: string): Promise<void> {
    const tokenHash = hashRefreshToken(presentedToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
          orderBy: { expiresAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    const activeSub = user.subscriptions.find((s) => s.expiresAt.getTime() > Date.now());
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      subscription: activeSub
        ? { status: 'ACTIVE' as const, expiresAt: activeSub.expiresAt.toISOString() }
        : null,
    };
  }

  private toPublicUser(user: { id: string; email: string; role: 'USER' | 'ADMIN' }): PublicUser {
    return { id: user.id, email: user.email, role: user.role };
  }

  private async issueTokens(
    userId: string,
    email: string,
    role: 'USER' | 'ADMIN',
  ): Promise<AuthTokens> {
    const jwtConfig = this.configService.get('jwt', { infer: true });

    const accessToken = await this.jwtService.signAsync(
      { sub: userId, email, role },
      { secret: jwtConfig.accessSecret, expiresIn: jwtConfig.accessTtl },
    );

    const refreshToken = randomBytes(48).toString('hex');
    const refreshTokenExpiresAt = new Date(Date.now() + parseDurationToMs(jwtConfig.refreshTtl));

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: refreshTokenExpiresAt,
      },
    });

    return { accessToken, refreshToken, refreshTokenExpiresAt };
  }
}
