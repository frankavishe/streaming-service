import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { AdminCatalogController } from './admin/admin.controller';
import { AdminTitlesService } from './admin/admin-titles.service';

@Module({
  controllers: [CatalogController, AdminCatalogController],
  providers: [CatalogService, AdminTitlesService],
  exports: [CatalogService],
})
export class CatalogModule {}
