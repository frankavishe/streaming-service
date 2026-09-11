import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config';
import configuration from './configuration';

// T017: loads and (in non-test envs) validates required env vars via ConfigService, wrapping
// @nestjs/config so the rest of the app depends on this module rather than process.env directly.
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: (config: Record<string, unknown>) => {
        if (process.env.NODE_ENV === 'test') {
          return config;
        }
        const required = [
          'DATABASE_URL',
          'JWT_ACCESS_SECRET',
          'JWT_REFRESH_SECRET',
          'S3_ACCESS_KEY_ID',
          'S3_SECRET_ACCESS_KEY',
        ];
        const missing = required.filter((key) => !config[key]);
        if (missing.length > 0) {
          throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
        }
        return config;
      },
    }),
  ],
  exports: [NestConfigModule],
})
export class AppConfigModule {}

export { ConfigService };
