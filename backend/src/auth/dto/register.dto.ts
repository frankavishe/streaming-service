import { IsEmail, IsString, MinLength } from 'class-validator';

// Password policy: minimum 8 characters (data-model.md: "meets a minimum strength policy
// enforced at the API boundary").
export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
