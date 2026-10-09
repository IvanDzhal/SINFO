import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString() @MinLength(2) firstName!: string;
  @IsString() @MinLength(2) lastName!: string;
  @IsString() @MinLength(3) login!: string;
  @IsString() @MinLength(6) password!: string;
  @IsArray() @ArrayMinSize(1) @IsUUID('4', { each: true }) roleIds!: string[];
  @IsOptional() @IsUUID() regionId?: string;
  @IsOptional() @IsUUID() cityId?: string;
  @IsOptional() @IsUUID() storeId?: string;
  @IsOptional() @IsString() position?: string;
}

export class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(2) firstName?: string;
  @IsOptional() @IsString() @MinLength(2) lastName?: string;
  @IsOptional() @IsIn(['active', 'inactive']) status?: 'active' | 'inactive';
  @IsOptional() @IsUUID() regionId?: string;
  @IsOptional() @IsUUID() cityId?: string;
  @IsOptional() @IsUUID() storeId?: string;
  @IsOptional() @IsString() position?: string;
}

export class ResetPasswordDto {
  @IsString() @MinLength(6) newPassword!: string;
}

export class ChangeLoginDto {
  @IsString() @MinLength(3) newLogin!: string;
}

export class SetUserRolesDto {
  @IsArray() @ArrayMinSize(1) @IsUUID('4', { each: true }) roleIds!: string[];
}

export class SetManagedRegionsDto {
  @IsArray() @IsUUID('4', { each: true }) regionIds!: string[];
}