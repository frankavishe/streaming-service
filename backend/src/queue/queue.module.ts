import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/configuration';

export const TRANSCODE_QUEUE = 'transcode';

// T021: registers the single BullMQ queue used for transcode jobs, backed by the shared Redis
// instance (also usable later as a general short-lived cache per research.md decision 6).
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService<AppConfig, true>) => ({
        connection: {
          url: configService.get('redisUrl', { infer: true }),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({ name: TRANSCODE_QUEUE }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
