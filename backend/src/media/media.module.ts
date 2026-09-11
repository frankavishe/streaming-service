import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { AdminMediaController } from './admin/admin-media.controller';
import { AdminMediaService } from './admin/admin-media.service';

@Module({
  imports: [QueueModule],
  controllers: [MediaController, AdminMediaController],
  providers: [MediaService, AdminMediaService],
  exports: [MediaService],
})
export class MediaModule {}
