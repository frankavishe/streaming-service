import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminMediaService } from './admin-media.service';
import { RegisterMediaAssetDto } from './dto/register-media-asset.dto';

// T070-T072: every route requires role=ADMIN (FR-019 — I1 remediation from /speckit-analyze).
@Controller('admin/media-assets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminMediaController {
  constructor(private readonly adminMediaService: AdminMediaService) {}

  @Post()
  register(@Body() dto: RegisterMediaAssetDto) {
    return this.adminMediaService.registerMediaAsset(dto);
  }

  @Post(':assetId/complete-upload')
  completeUpload(@Param('assetId') assetId: string) {
    return this.adminMediaService.completeUpload(assetId);
  }

  @Get(':assetId')
  getStatus(@Param('assetId') assetId: string) {
    return this.adminMediaService.getStatus(assetId);
  }
}
