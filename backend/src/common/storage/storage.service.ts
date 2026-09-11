import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AppConfig } from '../../config/configuration';

const UPLOAD_URL_TTL_SECONDS = 15 * 60; // 15 min to complete a direct upload
const PLAYBACK_URL_TTL_SECONDS = 60 * 60; // 1 hour signed playback window

// T020: wraps the S3-compatible client (MinIO locally, any S3-compatible provider in prod) and
// is the ONLY place that mints signed URLs — Constitution Principle IV requires every media URL
// (trailer and full alike) to be signed and time-expiring, never a permanent public link.
@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicClient: S3Client;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    const s3Config = this.configService.get('s3', { infer: true });
    this.bucket = s3Config.bucket;

    // Internal client: used for signing PUT URLs the container-to-container upload path uses,
    // and any server-side reads.
    this.client = new S3Client({
      endpoint: s3Config.endpoint,
      region: s3Config.region,
      forcePathStyle: s3Config.forcePathStyle,
      credentials: {
        accessKeyId: s3Config.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey,
      },
    });

    // Public client: same credentials, but its signature is computed against the
    // browser-reachable endpoint so signed GET/PUT URLs handed to the frontend actually resolve.
    this.publicClient = new S3Client({
      endpoint: s3Config.publicEndpoint,
      region: s3Config.region,
      forcePathStyle: s3Config.forcePathStyle,
      credentials: {
        accessKeyId: s3Config.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey,
      },
    });
  }

  /** Signed PUT URL an admin's browser uploads a raw video file directly to. */
  async getUploadUrl(objectKey: string, contentType = 'application/octet-stream') {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ContentType: contentType,
    });
    const url = await getSignedUrl(this.publicClient, command, {
      expiresIn: UPLOAD_URL_TTL_SECONDS,
    });
    const expiresAt = new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000).toISOString();
    return { url, expiresAt };
  }

  /** Signed, time-expiring GET URL for a trailer or full-video HLS manifest. */
  async getPlaybackUrl(objectKey: string) {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: objectKey });
    const url = await getSignedUrl(this.publicClient, command, {
      expiresIn: PLAYBACK_URL_TTL_SECONDS,
    });
    const expiresAt = new Date(Date.now() + PLAYBACK_URL_TTL_SECONDS * 1000).toISOString();
    return { url, expiresAt };
  }

  /** Internal (non-signed) client, for the worker to read/write objects server-side. */
  getInternalClient(): S3Client {
    return this.client;
  }

  getBucket(): string {
    return this.bucket;
  }
}
