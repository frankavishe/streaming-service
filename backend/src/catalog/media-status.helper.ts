import { PrismaService } from '../prisma/prisma.service';
import { MediaKind, MediaOwnerType } from '@prisma/client';

// Shared by CatalogService (US1: public catalog shapes) and AdminTitlesService (US4: publish
// guard) so "is this owner's TRAILER/FULL asset ready?" is answered the same way everywhere.

export interface MediaAssetStatus {
  assetId: string;
  ready: boolean;
}

export async function getMediaAssetStatus(
  prisma: PrismaService,
  ownerType: MediaOwnerType,
  ownerId: string,
  kind: MediaKind,
): Promise<MediaAssetStatus | null> {
  const asset = await prisma.mediaAsset.findUnique({
    where: { ownerType_ownerId_kind: { ownerType, ownerId, kind } },
  });
  if (!asset) return null;
  return { assetId: asset.id, ready: asset.processingStatus === 'READY' };
}
