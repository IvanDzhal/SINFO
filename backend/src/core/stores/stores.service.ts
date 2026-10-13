import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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

  // Код унікальний і зберігається у верхньому регістрі
  private async checkCode(code: string | undefined, selfId?: string) {
    if (!code) return undefined;
    const upper = code.trim().toUpperCase();
    const taken = await this.prisma.store.findUnique({ where: { code: upper } });
    if (taken && taken.id !== selfId) throw new ConflictException(`Код «${upper}» уже використовується`);
    return upper;
  }

  async create(actorId: string, dto: CreateStoreDto) {
    const code = await this.checkCode(dto.code);
    const store = await this.prisma.store.create({ data: { ...dto, code } });
    await this.audit.log(actorId, 'store.created', 'Store', store.id, { name: store.name });
    return store;
  }

  async update(actorId: string, id: string, dto: UpdateStoreDto) {
    await this.get(id);
    const code = await this.checkCode(dto.code, id);
    const store = await this.prisma.store.update({
      where: { id },
      data: { ...dto, ...(dto.code !== undefined ? { code } : {}) },
    });
    await this.audit.log(actorId, 'store.updated', 'Store', id, { ...dto });
    return store;
  }
}