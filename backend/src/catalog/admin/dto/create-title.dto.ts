import { IsArray, IsIn, IsString, IsUrl } from 'class-validator';

export class CreateTitleDto {
  @IsIn(['MOVIE', 'SERIES'])
  type!: 'MOVIE' | 'SERIES';

  @IsString()
  name!: string;

  @IsString()
  description!: string;

  @IsUrl({ require_tld: false })
  posterUrl!: string;

  @IsArray()
  @IsString({ each: true })
  genres!: string[];
}
