import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';

// T037: issues signed URLs for READY media assets. Never returns a bucket path directly —
// only ever a signed, time-expiring URL from StorageService (Constitution Principle IV).
@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async getTrailerUrl(assetId: string) {
    return this.getSignedUrlForReadyAsset(assetId, 'TRAILER');
  }

  async getPlaybackUrl(assetId: string) {
    return this.getSignedUrlForReadyAsset(assetId, 'FULL');
  }

  private async getSignedUrlForReadyAsset(assetId: string, expectedKind: 'TRAILER' | 'FULL') {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: assetId } });
    if (!asset || asset.kind !== expectedKind || asset.processingStatus !== 'READY' || !asset.hlsManifestKey) {
      throw new NotFoundException('Media asset not found or not ready');
    }
    return this.storageService.getPlaybackUrl(asset.hlsManifestKey);
  }
}
