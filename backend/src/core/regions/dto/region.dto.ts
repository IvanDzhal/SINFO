import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateRegionDto {
  @IsString() @MinLength(2) name!: string;
}

export class UpdateRegionDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsIn(['active', 'inactive']) status?: string;
}