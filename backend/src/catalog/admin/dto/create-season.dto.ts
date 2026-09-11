import { IsInt, Min } from 'class-validator';

export class CreateSeasonDto {
  @IsInt()
  @Min(1)
  number!: number;
}
