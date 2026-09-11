import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AppConfig } from '../config/configuration';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { JwtAccessPayload } from './jwt.strategy';
import { AuthService, AuthTokens } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const REFRESH_COOKIE_NAME = 'refreshToken';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  // T023 (T081: tighter throttle than the global default — auth endpoints are a common brute-force target)
  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { user, accessToken, refreshToken, refreshTokenExpiresAt } =
      await this.authService.register(dto);
    this.setRefreshCookie(res, refreshToken, refreshTokenExpiresAt);
    res.status(HttpStatus.CREATED);
    return { user, accessToken, refreshToken };
  }

  // T024 (T081)
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { user, accessToken, refreshToken, refreshTokenExpiresAt } =
      await this.authService.login(dto);
    this.setRefreshCookie(res, refreshToken, refreshTokenExpiresAt);
    return { user, accessToken, refreshToken };
  }

  // T025
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const presented = this.extractRefreshToken(req);
    if (!presented) {
      throw new UnauthorizedException('Missing refresh token');
    }
    const tokens: AuthTokens = await this.authService.refresh(presented);
    this.setRefreshCookie(res, tokens.refreshToken, tokens.refreshTokenExpiresAt);
    return { accessToken: tokens.accessToken };
  }

  // T026
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const presented = this.extractRefreshToken(req);
    if (presented) {
      await this.authService.logout(presented);
    }
    res.clearCookie(REFRESH_COOKIE_NAME);
  }

  // T027
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: JwtAccessPayload) {
    return this.authService.getMe(user.sub);
  }

  private extractRefreshToken(req: Request): string | undefined {
    return req.cookies?.[REFRESH_COOKIE_NAME] ?? req.body?.refreshToken;
  }

  private setRefreshCookie(res: Response, token: string, expiresAt: Date) {
    res.cookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/api/auth',
    });
  }
}
