import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListTitlesDto } from './dto/list-titles.dto';
import { getMediaAssetStatus } from './media-status.helper';

// T033: read-side catalog queries. Only `published: true` titles/episodes are ever returned
// through these methods (FR-001, FR-018) — the admin module has its own unfiltered queries.
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listTitles(query: ListTitlesDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where = {
      published: true,
      ...(query.type ? { type: query.type } : {}),
      ...(query.genre ? { genres: { some: { genre: { name: query.genre } } } } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.title.findMany({
        where,
        include: { genres: { include: { genre: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.title.count({ where }),
    ]);

    return {
      items: rows.map((title) => ({
        id: title.id,
        type: title.type,
        name: title.name,
        posterUrl: title.posterUrl,
        genres: title.genres.map((g) => g.genre.name),
      })),
      page,
      pageSize,
      total,
    };
  }

  async getTitleById(titleId: string) {
    const title = await this.prisma.title.findFirst({
      where: { id: titleId, published: true },
      include: {
        genres: { include: { genre: true } },
        seasons: {
          orderBy: { number: 'asc' },
          include: { episodes: { where: { published: true }, orderBy: { number: 'asc' } } },
        },
      },
    });
    if (!title) {
      throw new NotFoundException('Title not found');
    }

    const genres = title.genres.map((g) => g.genre.name);

    if (title.type === 'MOVIE') {
      const [trailer, full] = await Promise.all([
        getMediaAssetStatus(this.prisma, 'TITLE', title.id, 'TRAILER'),
        getMediaAssetStatus(this.prisma, 'TITLE', title.id, 'FULL'),
      ]);
      return {
        id: title.id,
        type: 'MOVIE' as const,
        name: title.name,
        description: title.description,
        posterUrl: title.posterUrl,
        genres,
        trailer,
        fullAvailable: full?.ready ?? false,
      };
    }

    const seasons = await Promise.all(
      title.seasons.map(async (season) => ({
        id: season.id,
        number: season.number,
        episodes: await Promise.all(
          season.episodes.map((episode) => this.toEpisodeShape(episode)),
        ),
      })),
    );

    return {
      id: title.id,
      type: 'SERIES' as const,
      name: title.name,
      description: title.description,
      posterUrl: title.posterUrl,
      genres,
      seasons,
    };
  }

  async getEpisodeById(episodeId: string) {
    const episode = await this.prisma.episode.findFirst({
      where: { id: episodeId, published: true },
    });
    if (!episode) {
      throw new NotFoundException('Episode not found');
    }
    return this.toEpisodeShape(episode);
  }

  private async toEpisodeShape(episode: {
    id: string;
    number: number;
    name: string;
    description: string;
  }) {
    const [trailer, full] = await Promise.all([
      getMediaAssetStatus(this.prisma, 'EPISODE', episode.id, 'TRAILER'),
      getMediaAssetStatus(this.prisma, 'EPISODE', episode.id, 'FULL'),
    ]);
    return {
      id: episode.id,
      number: episode.number,
      name: episode.name,
      description: episode.description,
      trailer,
      fullAvailable: full?.ready ?? false,
    };
  }
}
