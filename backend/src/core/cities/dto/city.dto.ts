import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateCityDto {
  @IsString() @MinLength(2) name!: string;
  @IsUUID() regionId!: string;
}

export class UpdateCityDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsUUID() regionId?: string;
  @IsOptional() @IsIn(['active', 'inactive']) status?: string;
}