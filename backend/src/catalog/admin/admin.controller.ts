import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminTitlesService } from './admin-titles.service';
import { CreateTitleDto } from './dto/create-title.dto';
import { UpdateTitleDto } from './dto/update-title.dto';
import { CreateSeasonDto } from './dto/create-season.dto';
import { CreateEpisodeDto } from './dto/create-episode.dto';
import { UpdateEpisodeDto } from './dto/update-episode.dto';

// T067-T069: FR-015, FR-019 — every route here requires role=ADMIN.
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminCatalogController {
  constructor(private readonly adminTitlesService: AdminTitlesService) {}

  @Get('titles')
  listTitles() {
    return this.adminTitlesService.listAllTitles();
  }

  @Get('titles/:titleId')
  getTitle(@Param('titleId') titleId: string) {
    return this.adminTitlesService.getTitleForAdmin(titleId);
  }

  @Post('titles')
  createTitle(@Body() dto: CreateTitleDto) {
    return this.adminTitlesService.createTitle(dto);
  }

  @Patch('titles/:titleId')
  updateTitle(@Param('titleId') titleId: string, @Body() dto: UpdateTitleDto) {
    return this.adminTitlesService.updateTitle(titleId, dto);
  }

  @Post('titles/:titleId/seasons')
  createSeason(@Param('titleId') titleId: string, @Body() dto: CreateSeasonDto) {
    return this.adminTitlesService.createSeason(titleId, dto);
  }

  @Post('seasons/:seasonId/episodes')
  createEpisode(@Param('seasonId') seasonId: string, @Body() dto: CreateEpisodeDto) {
    return this.adminTitlesService.createEpisode(seasonId, dto);
  }

  @Patch('episodes/:episodeId')
  updateEpisode(@Param('episodeId') episodeId: string, @Body() dto: UpdateEpisodeDto) {
    return this.adminTitlesService.updateEpisode(episodeId, dto);
  }
}
