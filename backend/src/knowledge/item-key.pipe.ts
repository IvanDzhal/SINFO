import { Injectable, NotFoundException, PipeTransform } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ItemKeyPipe implements PipeTransform<string, Promise<string>> {
  constructor(private prisma: PrismaService) {}

  async transform(key: string): Promise<string> {
    if (UUID_RE.test(key)) return key;
    const found = await this.prisma.knowledgeItem.findUnique({
      where: { slug: key },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Матеріал не знайдено');
    return found.id;
  }
}