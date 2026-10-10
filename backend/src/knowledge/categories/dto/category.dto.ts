import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsUUID() parentId?: string;
}

export class UpdateCategoryDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() icon?: string;
}