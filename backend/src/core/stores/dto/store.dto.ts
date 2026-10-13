import { IsIn, IsOptional, IsString, IsUUID, Matches, MinLength, ValidateIf } from 'class-validator';

// Короткий код магазину: ЗАБ, СТЛ, ГЛ…
const CODE_RE = /^[A-Za-zА-Яа-яІіЇїЄєҐґ0-9_-]{1,10}$/;

export class CreateStoreDto {
  @IsString() @MinLength(2) name!: string;
  @IsUUID() regionId!: string;
  @IsUUID() cityId!: string;
  @IsUUID() brandFormatId!: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() @ValidateIf((o) => o.code !== '') @Matches(CODE_RE) code?: string;
}

export class UpdateStoreDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsUUID() regionId?: string;
  @IsOptional() @IsUUID() cityId?: string;
  @IsOptional() @IsUUID() brandFormatId?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsIn(['active', 'inactive']) status?: string;
  @IsOptional() @IsString() @ValidateIf((o) => o.code !== '') @Matches(CODE_RE) code?: string;
}