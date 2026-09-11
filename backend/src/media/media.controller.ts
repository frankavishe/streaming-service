import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { EntitlementGuard } from '../common/guards/entitlement.guard';
import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  // T038: no auth required (FR-002).
  @Get(':assetId/trailer-url')
  getTrailerUrl(@Param('assetId') assetId: string) {
    return this.mediaService.getTrailerUrl(assetId);
  }

  // T039: 401 (JwtAuthGuard) then 403 (EntitlementGuard) then 200/404 (FR-003, FR-005).
  @Get(':assetId/playback-url')
  @UseGuards(JwtAuthGuard, EntitlementGuard)
  getPlaybackUrl(@Param('assetId') assetId: string) {
    return this.mediaService.getPlaybackUrl(assetId);
  }
}
