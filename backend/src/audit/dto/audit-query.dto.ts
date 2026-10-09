import { IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';

export class AuditQueryDto {
  @IsOptional() @IsUUID() actorId?: string;
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsString() entityType?: string;
  @IsOptional() @IsISO8601() dateFrom?: string;
  @IsOptional() @IsISO8601() dateTo?: string;
}