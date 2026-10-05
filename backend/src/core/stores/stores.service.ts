import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateStoreDto, UpdateStoreDto } from './dto/store.dto';

@Injectable()
export class StoresService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  list(filters: { regionId?: string; cityId?: string; status?: string }) {
    return this.prisma.store.findMany({
      where: filters,
      orderBy: { name: 'asc' },
      include: { region: true, city: true, brandFormat: true },
    });
  }

  async get(id: string) {
    const store = await this.prisma.store.findUnique({
      where: { id },
      include: { region: true, city: true, brandFormat: true, users: true },
    });
    if (!store) throw new NotFoundException('Магазин не знайдено');
    return store;
  }

  async create(actorId: string, dto: CreateStoreDto) {
    const store = await this.prisma.store.create({ data: dto });
    await this.audit.log(actorId, 'store.created', 'Store', store.id, { name: store.name });
    return store;
  }

  async update(actorId: string, id: string, dto: UpdateStoreDto) {
    await this.get(id);
    const store = await this.prisma.store.update({ where: { id }, data: dto });
    await this.audit.log(actorId, 'store.updated', 'Store', id, { ...dto });
    return store;
  }
}