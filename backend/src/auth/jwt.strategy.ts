import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfig } from '../config/configuration';

export interface JwtAccessPayload {
  sub: string; // user id
  email: string;
  role: 'USER' | 'ADMIN';
}

// T022: validates the short-lived access token sent as `Authorization: Bearer <token>`.
// Deliberately does NOT read the DB on every request (that's what EntitlementGuard is for,
// scoped only to the endpoints that need it) — this strategy just proves "this is a genuine,
// unexpired access token for this user".
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService<AppConfig, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt', { infer: true }).accessSecret,
    });
  }

  async validate(payload: JwtAccessPayload): Promise<JwtAccessPayload> {
    return payload;
  }
}
