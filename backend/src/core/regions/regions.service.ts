import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateRegionDto, UpdateRegionDto } from './dto/region.dto';

@Injectable()
export class RegionsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  list(status?: string) {
    return this.prisma.region.findMany({
      where: status ? { status } : {},
      orderBy: { name: 'asc' },
      include: { _count: { select: { cities: true, stores: true } } },
    });
  }

  async get(id: string) {
    const region = await this.prisma.region.findUnique({
      where: { id },
      include: { cities: true, _count: { select: { stores: true } } },
    });
    if (!region) throw new NotFoundException('Область не знайдено');
    return region;
  }

  async create(actorId: string, dto: CreateRegionDto) {
    const region = await this.prisma.region.create({ data: { name: dto.name } });
    await this.audit.log(actorId, 'region.created', 'Region', region.id, { name: region.name });
    return region;
  }

  async update(actorId: string, id: string, dto: UpdateRegionDto) {
    await this.get(id);
    const region = await this.prisma.region.update({ where: { id }, data: dto });
    await this.audit.log(actorId, 'region.updated', 'Region', id, { ...dto });
    return region;
  }
}