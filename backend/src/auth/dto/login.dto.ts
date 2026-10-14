import { IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsString() @MaxLength(100) login!: string;
  @IsString() @MaxLength(128) password!: string;
}
