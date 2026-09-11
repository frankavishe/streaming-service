import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

// T074: separate bootstrap from the API — a pure BullMQ consumer with no HTTP listener. Built as
// the `worker` Docker target (with ffmpeg installed), sharing the same NestJS source as the API.
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  // eslint-disable-next-line no-console
  console.log('Transcode worker started, waiting for jobs…');

  const shutdown = async () => {
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap();
