import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateCityDto, UpdateCityDto } from './dto/city.dto';

@Injectable()
export class CitiesService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  list(regionId?: string) {
    return this.prisma.city.findMany({
      where: regionId ? { regionId } : {},
      orderBy: { name: 'asc' },
      include: { region: true, _count: { select: { stores: true } } },
    });
  }

  async get(id: string) {
    const city = await this.prisma.city.findUnique({
      where: { id },
      include: { region: true, stores: true },
    });
    if (!city) throw new NotFoundException('Місто не знайдено');
    return city;
  }

  async create(actorId: string, dto: CreateCityDto) {
    const city = await this.prisma.city.create({ data: dto });
    await this.audit.log(actorId, 'city.created', 'City', city.id, { name: city.name });
    return city;
  }

  async update(actorId: string, id: string, dto: UpdateCityDto) {
    await this.get(id);
    const city = await this.prisma.city.update({ where: { id }, data: dto });
    await this.audit.log(actorId, 'city.updated', 'City', id, { ...dto });
    return city;
  }
}