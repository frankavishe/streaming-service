import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Thin named wrapper around Passport's 'jwt' strategy so controllers read `@UseGuards(JwtAuthGuard)`.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
