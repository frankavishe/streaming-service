import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { TRANSCODE_QUEUE } from '../../queue/queue.module';
import { TranscodeJobData } from '../../queue/transcode-job.types';
import { RegisterMediaAssetDto } from './dto/register-media-asset.dto';

// T070-T072: admin video upload lifecycle (FR-016, FR-017, FR-018, FR-019).
@Injectable()
export class AdminMediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    @InjectQueue(TRANSCODE_QUEUE) private readonly transcodeQueue: Queue<TranscodeJobData>,
  ) {}

  // T070
  async registerMediaAsset(dto: RegisterMediaAssetDto) {
    await this.assertOwnerExists(dto.ownerType, dto.ownerId);

    const sourceObjectKey = `sources/${dto.ownerType.toLowerCase()}/${dto.ownerId}/${dto.kind.toLowerCase()}/${uuid()}`;

    const asset = await this.prisma.mediaAsset.upsert({
      where: {
        ownerType_ownerId_kind: { ownerType: dto.ownerType, ownerId: dto.ownerId, kind: dto.kind },
      },
      update: { sourceObjectKey, processingStatus: 'PENDING', hlsManifestKey: null, failureReason: null },
      create: {
        ownerType: dto.ownerType,
        ownerId: dto.ownerId,
        kind: dto.kind,
        sourceObjectKey,
        processingStatus: 'PENDING',
      },
    });

    const { url: uploadUrl } = await this.storageService.getUploadUrl(sourceObjectKey, 'video/mp4');
    return { assetId: asset.id, uploadUrl };
  }

  // T071
  async completeUpload(assetId: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: assetId } });
    if (!asset) {
      throw new NotFoundException('Media asset not found');
    }

    await this.prisma.mediaAsset.update({
      where: { id: assetId },
      data: { processingStatus: 'PENDING', failureReason: null },
    });

    // Only FULL assets need HLS transcoding; a TRAILER may use a simpler delivery path per the
    // Constitution's Technology & Architecture Constraints, so it's marked READY immediately.
    if (asset.kind === 'FULL') {
      await this.transcodeQueue.add('transcode', {
        mediaAssetId: assetId,
        sourceObjectKey: asset.sourceObjectKey,
      });
    } else {
      await this.prisma.mediaAsset.update({
        where: { id: assetId },
        data: { processingStatus: 'READY', hlsManifestKey: asset.sourceObjectKey },
      });
    }

    return { assetId, processingStatus: 'PENDING' as const };
  }

  // T072
  async getStatus(assetId: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: assetId } });
    if (!asset) {
      throw new NotFoundException('Media asset not found');
    }
    return {
      assetId: asset.id,
      processingStatus: asset.processingStatus,
      ...(asset.failureReason ? { failureReason: asset.failureReason } : {}),
    };
  }

  // U1 remediation: ownerId is a polymorphic reference with no DB-level FK, so we validate it
  // points to a real row of the stated ownerType before creating the MediaAsset.
  private async assertOwnerExists(ownerType: 'TITLE' | 'EPISODE', ownerId: string): Promise<void> {
    const exists =
      ownerType === 'TITLE'
        ? await this.prisma.title.findUnique({ where: { id: ownerId } })
        : await this.prisma.episode.findUnique({ where: { id: ownerId } });
    if (!exists) {
      throw new UnprocessableEntityException(`${ownerType} ${ownerId} does not exist`);
    }
  }
}
