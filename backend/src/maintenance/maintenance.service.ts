import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateMaintenanceDto } from './dto/maintenance.dto';

@Injectable()
export class MaintenanceService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  // Найближче незавершене вікно робіт (поточне або заплановане) — для плашки
  async active() {
    const notice = await this.prisma.maintenanceWindow.findFirst({
      where: { endsAt: { gt: new Date() } },
      orderBy: { startsAt: 'asc' },
      select: { startsAt: true, endsAt: true, message: true },
    });
    return { notice };
  }

  list() {
    return this.prisma.maintenanceWindow.findMany({ orderBy: { startsAt: 'desc' }, take: 50 });
  }

  async create(actorId: string, dto: CreateMaintenanceDto) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) throw new BadRequestException('Кінець має бути пізніше за початок');
    const row = await this.prisma.maintenanceWindow.create({
      data: { startsAt, endsAt, message: dto.message?.trim() ?? '', createdById: actorId },
    });
    await this.audit.log(actorId, 'maintenance.created', 'MaintenanceWindow', row.id, {
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
    });
    return row;
  }

  async remove(actorId: string, id: string) {
    const row = await this.prisma.maintenanceWindow.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Запис не знайдено');
    await this.prisma.maintenanceWindow.delete({ where: { id } });
    await this.audit.log(actorId, 'maintenance.deleted', 'MaintenanceWindow', id);
    return { ok: true };
  }
}
