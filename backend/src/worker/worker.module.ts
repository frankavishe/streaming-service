import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/config.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../common/storage/storage.module';
import { QueueModule } from '../queue/queue.module';
import { TranscodeProcessor } from './transcode.processor';

@Module({
  imports: [AppConfigModule, PrismaModule, StorageModule, QueueModule],
  providers: [TranscodeProcessor],
})
export class WorkerModule {}
