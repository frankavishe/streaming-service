import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getMediaAssetStatus } from '../media-status.helper';
import { CreateTitleDto } from './dto/create-title.dto';
import { UpdateTitleDto } from './dto/update-title.dto';
import { CreateSeasonDto } from './dto/create-season.dto';
import { CreateEpisodeDto } from './dto/create-episode.dto';
import { UpdateEpisodeDto } from './dto/update-episode.dto';

// T066: admin-side catalog mutations (FR-015). Unlike CatalogService, these read/write
// regardless of `published` state — an admin must be able to see and edit a draft title.
@Injectable()
export class AdminTitlesService {
  constructor(private readonly prisma: PrismaService) {}

  // Not in contracts/admin-api.md, but required for the admin UI to find and edit draft titles
  // (which the public /api/catalog/titles endpoint hides). Small, low-risk addition alongside
  // the documented admin endpoints.
  async listAllTitles() {
    const titles = await this.prisma.title.findMany({
      include: { genres: { include: { genre: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return titles.map((title) => ({
      id: title.id,
      type: title.type,
      name: title.name,
      posterUrl: title.posterUrl,
      published: title.published,
      genres: title.genres.map((g) => g.genre.name),
    }));
  }

  async getTitleForAdmin(titleId: string) {
    const title = await this.prisma.title.findUnique({
      where: { id: titleId },
      include: {
        genres: { include: { genre: true } },
        seasons: { orderBy: { number: 'asc' }, include: { episodes: { orderBy: { number: 'asc' } } } },
      },
    });
    if (!title) {
      throw new NotFoundException('Title not found');
    }
    return {
      id: title.id,
      type: title.type,
      name: title.name,
      description: title.description,
      posterUrl: title.posterUrl,
      published: title.published,
      genres: title.genres.map((g) => g.genre.name),
      seasons: title.seasons.map((season) => ({
        id: season.id,
        number: season.number,
        episodes: season.episodes.map((episode) => ({
          id: episode.id,
          number: episode.number,
          name: episode.name,
          description: episode.description,
          published: episode.published,
        })),
      })),
    };
  }

  async createTitle(dto: CreateTitleDto) {
    const genreConnections = await this.resolveGenres(dto.genres);
    const title = await this.prisma.title.create({
      data: {
        type: dto.type,
        name: dto.name,
        description: dto.description,
        posterUrl: dto.posterUrl,
        published: false,
        genres: { create: genreConnections.map((genreId) => ({ genreId })) },
      },
    });
    return title;
  }

  async updateTitle(titleId: string, dto: UpdateTitleDto) {
    const title = await this.prisma.title.findUnique({ where: { id: titleId } });
    if (!title) {
      throw new NotFoundException('Title not found');
    }

    if (dto.published === true) {
      const canPublish = await this.canPublish(titleId, title.type);
      if (!canPublish) {
        throw new UnprocessableEntityException(
          'Cannot publish a title with no ready playable content beneath it',
        );
      }
    }

    const genreUpdate = dto.genres
      ? {
          genres: {
            deleteMany: {},
            create: (await this.resolveGenres(dto.genres)).map((genreId) => ({ genreId })),
          },
        }
      : {};

    return this.prisma.title.update({
      where: { id: titleId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.posterUrl !== undefined ? { posterUrl: dto.posterUrl } : {}),
        ...(dto.published !== undefined ? { published: dto.published } : {}),
        ...genreUpdate,
      },
    });
  }

  async createSeason(titleId: string, dto: CreateSeasonDto) {
    const title = await this.prisma.title.findUnique({ where: { id: titleId } });
    if (!title) {
      throw new NotFoundException('Title not found');
    }
    if (title.type !== 'SERIES') {
      throw new UnprocessableEntityException('Seasons can only be added to a SERIES title');
    }
    return this.prisma.season.create({ data: { titleId, number: dto.number } });
  }

  async createEpisode(seasonId: string, dto: CreateEpisodeDto) {
    const season = await this.prisma.season.findUnique({ where: { id: seasonId } });
    if (!season) {
      throw new NotFoundException('Season not found');
    }
    return this.prisma.episode.create({
      data: { seasonId, number: dto.number, name: dto.name, description: dto.description, published: false },
    });
  }

  async updateEpisode(episodeId: string, dto: UpdateEpisodeDto) {
    const episode = await this.prisma.episode.findUnique({ where: { id: episodeId } });
    if (!episode) {
      throw new NotFoundException('Episode not found');
    }

    if (dto.published === true) {
      const full = await getMediaAssetStatus(this.prisma, 'EPISODE', episodeId, 'FULL');
      if (!full?.ready) {
        throw new UnprocessableEntityException(
          'Cannot publish an episode whose FULL video is not ready',
        );
      }
    }

    return this.prisma.episode.update({
      where: { id: episodeId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.published !== undefined ? { published: dto.published } : {}),
      },
    });
  }

  /** A MOVIE needs its own FULL asset ready; a SERIES needs at least one published, ready episode. */
  private async canPublish(titleId: string, type: 'MOVIE' | 'SERIES'): Promise<boolean> {
    if (type === 'MOVIE') {
      const full = await getMediaAssetStatus(this.prisma, 'TITLE', titleId, 'FULL');
      return full?.ready ?? false;
    }

    const episodes = await this.prisma.episode.findMany({
      where: { season: { titleId }, published: true },
    });
    for (const episode of episodes) {
      const full = await getMediaAssetStatus(this.prisma, 'EPISODE', episode.id, 'FULL');
      if (full?.ready) return true;
    }
    return false;
  }

  private async resolveGenres(names: string[]): Promise<string[]> {
    if (names.length === 0) return [];
    const genres = await Promise.all(
      names.map((name) =>
        this.prisma.genre.upsert({ where: { name }, update: {}, create: { name } }),
      ),
    );
    return genres.map((g) => g.id);
  }
}
