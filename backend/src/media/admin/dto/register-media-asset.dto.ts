import { IsIn, IsString } from 'class-validator';

export class RegisterMediaAssetDto {
  @IsIn(['TITLE', 'EPISODE'])
  ownerType!: 'TITLE' | 'EPISODE';

  @IsString()
  ownerId!: string;

  @IsIn(['TRAILER', 'FULL'])
  kind!: 'TRAILER' | 'FULL';
}
