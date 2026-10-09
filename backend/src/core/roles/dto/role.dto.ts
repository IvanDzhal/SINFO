import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsOptional, IsString, IsUUID, MinLength, ValidateNested } from 'class-validator';
import { Scope } from '@prisma/client';

export class CreateRoleDto {
  @IsString() @MinLength(2) name!: string;
}

export class UpdateRoleDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
}

class PermissionAssignment {
  @IsUUID() permissionId!: string;
  @IsEnum(Scope) scope!: Scope;
}

export class SetRolePermissionsDto {
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => PermissionAssignment)
  permissions!: PermissionAssignment[];
}