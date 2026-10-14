import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

// Лише YouTube: власне сховище відео не використовуємо
const YOUTUBE = /^https:\/\/(www\.|m\.)?(youtube\.com\/(watch\?|embed\/|shorts\/)|youtu\.be\/)[^\s]+$/i;

export class CreateStageDto {
  @IsString() @MinLength(2) @MaxLength(150) title!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
}

export class UpdateStageDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150) title?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsUUID() testId?: string | null;
}

export class ReorderDto {
  @IsArray() @ArrayMaxSize(200) @IsUUID(undefined, { each: true }) ids!: string[];
}

export class CreateLessonDto {
  @IsIn(['text', 'video', 'pdf']) kind!: 'text' | 'video' | 'pdf';
  @IsString() @MinLength(2) @MaxLength(150) title!: string;
  @IsOptional() @IsArray() content?: unknown[];
  @IsOptional() @Matches(YOUTUBE, { message: 'Потрібне посилання на YouTube' }) videoUrl?: string;
  @IsOptional() @IsUUID() fileId?: string;
}

export class UpdateLessonDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150) title?: string;
  @IsOptional() @IsArray() content?: unknown[];
  @IsOptional() @Matches(YOUTUBE, { message: 'Потрібне посилання на YouTube' }) videoUrl?: string;
  @IsOptional() @IsUUID() fileId?: string;
}

