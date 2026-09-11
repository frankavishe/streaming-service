import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import ffmpeg from 'fluent-ffmpeg';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { createWriteStream } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { TRANSCODE_QUEUE } from '../queue/queue.module';
import { TranscodeJobData } from '../queue/transcode-job.types';

interface Rendition {
  name: string;
  width: number;
  height: number;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
}

// T073: multi-bitrate HLS transcode. Three renditions is a pragmatic MVP default — enough to
// exercise real adaptive-bitrate switching (FR-017) without an unbounded matrix of variants.
const RENDITIONS: Rendition[] = [
  { name: '360p', width: 640, height: 360, videoBitrateKbps: 800, audioBitrateKbps: 96 },
  { name: '720p', width: 1280, height: 720, videoBitrateKbps: 2800, audioBitrateKbps: 128 },
  { name: '1080p', width: 1920, height: 1080, videoBitrateKbps: 5000, audioBitrateKbps: 160 },
];

@Processor(TRANSCODE_QUEUE)
export class TranscodeProcessor extends WorkerHost {
  private readonly logger = new Logger(TranscodeProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {
    super();
  }

  async process(job: Job<TranscodeJobData>): Promise<void> {
    const { mediaAssetId, sourceObjectKey } = job.data;
    this.logger.log(`Starting transcode for asset ${mediaAssetId}`);

    const workDir = await mkdtemp(join(tmpdir(), 'transcode-'));
    try {
      const sourcePath = join(workDir, 'source');
      await this.downloadSource(sourceObjectKey, sourcePath);

      const manifestKey = `hls/${mediaAssetId}/master.m3u8`;
      const variantLines: string[] = ['#EXTM3U', '#EXT-X-VERSION:3'];

      for (const rendition of RENDITIONS) {
        const outDir = join(workDir, rendition.name);
        await this.transcodeRendition(sourcePath, outDir, rendition);

        const playlistKey = `hls/${mediaAssetId}/${rendition.name}/playlist.m3u8`;
        await this.uploadDirectory(outDir, `hls/${mediaAssetId}/${rendition.name}`);

        const bandwidth = (rendition.videoBitrateKbps + rendition.audioBitrateKbps) * 1000;
        variantLines.push(
          `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${rendition.width}x${rendition.height}`,
          `${rendition.name}/playlist.m3u8`,
        );
        void playlistKey; // referenced for clarity/documentation of the relative path above
      }

      const masterPlaylistPath = join(workDir, 'master.m3u8');
      await writeFile(masterPlaylistPath, variantLines.join('\n') + '\n');
      await this.uploadFile(masterPlaylistPath, manifestKey);

      await this.prisma.mediaAsset.update({
        where: { id: mediaAssetId },
        data: { processingStatus: 'READY', hlsManifestKey: manifestKey, failureReason: null },
      });
      this.logger.log(`Transcode complete for asset ${mediaAssetId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Transcode failed for asset ${mediaAssetId}: ${message}`);
      await this.prisma.mediaAsset.update({
        where: { id: mediaAssetId },
        data: { processingStatus: 'FAILED', failureReason: message },
      });
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  private async downloadSource(objectKey: string, destPath: string): Promise<void> {
    const client = this.storageService.getInternalClient();
    const response = await client.send(
      new GetObjectCommand({ Bucket: this.storageService.getBucket(), Key: objectKey }),
    );
    const body = response.Body;
    if (!body) throw new Error(`Source object ${objectKey} has no body`);

    await new Promise<void>((resolve, reject) => {
      const writeStream = createWriteStream(destPath);
      (body as NodeJS.ReadableStream).pipe(writeStream);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  }

  private async transcodeRendition(sourcePath: string, outDir: string, rendition: Rendition): Promise<void> {
    const fsPromises = await import('fs/promises');
    await fsPromises.mkdir(outDir, { recursive: true });

    return new Promise((resolve, reject) => {
      ffmpeg(sourcePath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .size(`${rendition.width}x${rendition.height}`)
        .videoBitrate(rendition.videoBitrateKbps)
        .audioBitrate(rendition.audioBitrateKbps)
        .outputOptions([
          '-hls_time 6',
          '-hls_playlist_type vod',
          '-hls_segment_filename', join(outDir, 'segment%03d.ts'),
        ])
        .output(join(outDir, 'playlist.m3u8'))
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err))
        .run();
    });
  }

  private async uploadDirectory(localDir: string, prefix: string): Promise<void> {
    const fsPromises = await import('fs/promises');
    const entries = await fsPromises.readdir(localDir);
    for (const entry of entries) {
      await this.uploadFile(join(localDir, entry), `${prefix}/${entry}`);
    }
  }

  private async uploadFile(localPath: string, objectKey: string): Promise<void> {
    const client = this.storageService.getInternalClient();
    const body = await readFile(localPath);
    const contentType = objectKey.endsWith('.m3u8')
      ? 'application/vnd.apple.mpegurl'
      : objectKey.endsWith('.ts')
        ? 'video/mp2t'
        : 'application/octet-stream';
    await client.send(
      new PutObjectCommand({
        Bucket: this.storageService.getBucket(),
        Key: objectKey,
        Body: body,
        ContentType: contentType,
      }),
    );
  }
}
