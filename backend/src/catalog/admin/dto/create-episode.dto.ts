import { IsInt, IsString, Min } from 'class-validator';

export class CreateEpisodeDto {
  @IsInt()
  @Min(1)
  number!: number;

  @IsString()
  name!: string;

  @IsString()
  description!: string;
}
