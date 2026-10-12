import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Difficulty, QuestionType } from '@prisma/client';

export class OptionDto {
  @IsOptional() @IsUUID() id?: string;
  @IsString() label!: string;
  @IsOptional() @IsString() matchLabel?: string | null;
  @IsOptional() @IsBoolean() isCorrect?: boolean;
}

export class AcceptedDto {
  @IsIn(['text', 'number']) kind!: 'text' | 'number';
  @IsArray() @IsString({ each: true }) answers!: string[];
  @IsOptional() @IsNumber() @Min(0) tolerance?: number;
}

export class CreateQuestionDto {
  @IsEnum(QuestionType) type!: QuestionType;
  @IsString() text!: string;
  @IsOptional() @IsString() explanation?: string;
  @IsOptional() @IsEnum(Difficulty) difficulty?: Difficulty;
  @IsOptional() @IsInt() @Min(1) @Max(100) points?: number;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OptionDto)
  options?: OptionDto[];
  @IsOptional() @ValidateNested() @Type(() => AcceptedDto) accepted?: AcceptedDto;
}

export class UpdateQuestionDto {
  @IsOptional() @IsString() text?: string;
  @IsOptional() @IsString() explanation?: string;
  @IsOptional() @IsEnum(Difficulty) difficulty?: Difficulty;
  @IsOptional() @IsInt() @Min(1) @Max(100) points?: number;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OptionDto)
  options?: OptionDto[];
  @IsOptional() @ValidateNested() @Type(() => AcceptedDto) accepted?: AcceptedDto;
}

export class ReorderDto {
  @IsArray() @IsUUID('all', { each: true }) ids!: string[];
}