import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { KnowledgeType, VisibilityKind } from '@prisma/client';

export class VisibilityRuleDto {
  @IsEnum(VisibilityKind) kind!: VisibilityKind;
  @IsOptional() @IsString() targetId?: string;
}

export class CreateItemDto {
  @IsEnum(KnowledgeType) type!: KnowledgeType;
  @IsString() @MinLength(2) title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() categoryId?: string | null;
  @IsOptional() content?: unknown;
  @IsOptional() @IsBoolean() isRequired?: boolean;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VisibilityRuleDto)
  visibility?: VisibilityRuleDto[];
}

export class UpdateItemDto {
  @IsOptional() @IsString() @MinLength(2) title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() categoryId?: string | null;
  @IsOptional() content?: unknown;
  @IsOptional() @IsBoolean() isRequired?: boolean;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VisibilityRuleDto)
  visibility?: VisibilityRuleDto[];
}