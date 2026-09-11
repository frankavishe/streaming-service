import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { ListTitlesDto } from './dto/list-titles.dto';

// T034-T036: public, unauthenticated catalog endpoints (FR-001).
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('titles')
  listTitles(@Query() query: ListTitlesDto) {
    return this.catalogService.listTitles(query);
  }

  @Get('titles/:titleId')
  getTitle(@Param('titleId') titleId: string) {
    return this.catalogService.getTitleById(titleId);
  }

  @Get('episodes/:episodeId')
  getEpisode(@Param('episodeId') episodeId: string) {
    return this.catalogService.getEpisodeById(episodeId);
  }
}
