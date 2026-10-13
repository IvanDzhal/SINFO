import { IsOptional } from 'class-validator';

export class AnswerDto {
  @IsOptional() answer?: unknown;
}