import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateMaintenanceDto {
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @IsOptional() @IsString() @MaxLength(300) message?: string;
}
