import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { VisibilityRuleDto } from '../../knowledge/manage/dto/item.dto';

export class CreateTestDto {
  @IsString() @MinLength(2) title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() categoryId?: string | null;
  @IsOptional() @IsUUID() linkedItemId?: string | null;
  @IsOptional() @IsBoolean() isRequired?: boolean;
  @IsOptional() @IsISO8601() deadline?: string | null;
  @IsOptional() @IsInt() @Min(1) @Max(100) questionCount?: number;
  @IsOptional() @IsInt() @Min(1) @Max(240) timeLimitMinutes?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100) passingScorePercent?: number;
  @IsOptional() @IsInt() @Min(0) @Max(20) maxAttempts?: number;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VisibilityRuleDto)
  visibility?: VisibilityRuleDto[];
}

export class UpdateTestDto {
  @IsOptional() @IsString() @MinLength(2) title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() categoryId?: string | null;
  @IsOptional() @IsUUID() linkedItemId?: string | null;
  @IsOptional() @IsBoolean() isRequired?: boolean;
  @IsOptional() @IsISO8601() deadline?: string | null;
  @IsOptional() @IsInt() @Min(1) @Max(100) questionCount?: number;
  @IsOptional() @IsInt() @Min(1) @Max(240) timeLimitMinutes?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100) passingScorePercent?: number;
  @IsOptional() @IsInt() @Min(0) @Max(20) maxAttempts?: number;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VisibilityRuleDto)
  visibility?: VisibilityRuleDto[];
}