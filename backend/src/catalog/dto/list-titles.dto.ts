import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListTitlesDto {
  @IsOptional()
  @IsString()
  genre?: string;

  @IsOptional()
  @IsIn(['MOVIE', 'SERIES'])
  type?: 'MOVIE' | 'SERIES';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
