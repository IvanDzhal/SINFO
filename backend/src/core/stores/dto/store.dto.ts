import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateStoreDto {
  @IsString() @MinLength(2) name!: string;
  @IsUUID() regionId!: string;
  @IsUUID() cityId!: string;
  @IsUUID() brandFormatId!: string;
  @IsOptional() @IsString() address?: string;
}

export class UpdateStoreDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsUUID() regionId?: string;
  @IsOptional() @IsUUID() cityId?: string;
  @IsOptional() @IsUUID() brandFormatId?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsIn(['active', 'inactive']) status?: string;
}