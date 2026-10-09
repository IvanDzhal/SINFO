import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.permission.findMany({ orderBy: { code: 'asc' } });
  }
}