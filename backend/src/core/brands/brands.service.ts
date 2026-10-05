import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateBrandDto, UpdateBrandDto } from './dto/brand.dto';

@Injectable()
export class BrandsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  list(status?: string) {
    return this.prisma.brandFormat.findMany({
      where: status ? { status } : {},
      orderBy: { name: 'asc' },
    });
  }

  async get(id: string) {
    const brand = await this.prisma.brandFormat.findUnique({ where: { id } });
    if (!brand) throw new NotFoundException('Бренд не знайдено');
    return brand;
  }

  async create(actorId: string, dto: CreateBrandDto) {
    const brand = await this.prisma.brandFormat.create({ data: dto });
    await this.audit.log(actorId, 'brand.created', 'BrandFormat', brand.id, { name: brand.name });
    return brand;
  }

  async update(actorId: string, id: string, dto: UpdateBrandDto) {
    await this.get(id);
    const brand = await this.prisma.brandFormat.update({ where: { id }, data: dto });
    await this.audit.log(actorId, 'brand.updated', 'BrandFormat', id, { ...dto });
    return brand;
  }
}