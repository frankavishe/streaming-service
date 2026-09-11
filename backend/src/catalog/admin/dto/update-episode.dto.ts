import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateEpisodeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}
