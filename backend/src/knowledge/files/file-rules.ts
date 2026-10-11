import { BadRequestException } from '@nestjs/common';

export type FileKind = 'image' | 'document';
export type UploadedFileData = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

type Rule = {
  mime: string;
  ext: string[];
  kind: FileKind;
  maxMb: number;
  magic: (b: Buffer) => boolean;
};

const startsWith = (b: Buffer, sig: number[]) => sig.every((v, i) => b[i] === v);
const zip = (b: Buffer) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]);

// Дозволені типи й ліміти розміру (тут їх можна змінити)
const RULES: Rule[] = [
  {
    mime: 'image/png',
    ext: ['png'],
    kind: 'image',
    maxMb: 5,
    magic: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47]),
  },
  {
    mime: 'image/jpeg',
    ext: ['jpg', 'jpeg'],
    kind: 'image',
    maxMb: 5,
    magic: (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  },
  {
    mime: 'image/webp',
    ext: ['webp'],
    kind: 'image',
    maxMb: 5,
    magic: (b) =>
      b.length > 12 && b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP',
  },
  {
    mime: 'application/pdf',
    ext: ['pdf'],
    kind: 'document',
    maxMb: 20,
    magic: (b) => b.subarray(0, 5).toString() === '%PDF-',
  },
  {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ext: ['docx'],
    kind: 'document',
    maxMb: 20,
    magic: zip,
  },
  {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ext: ['xlsx'],
    kind: 'document',
    maxMb: 20,
    magic: zip,
  },
];

// multer віддає ім'я у кодуванні latin1, повертаємо нормальний UTF-8
function fixName(raw: string) {
  let name = raw;
  if ([...raw].every((c) => c.charCodeAt(0) <= 0xff)) {
    const decoded = Buffer.from(raw, 'latin1').toString('utf8');
    if (!decoded.includes('\uFFFD')) name = decoded;
  }
  return name.replace(/[\\/\u0000-\u001f]/g, '_').slice(0, 150) || 'file';
}

export function validateFile(file: {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}) {
  const name = fixName(file.originalname);
  const ext = name.includes('.') ? (name.split('.').pop() ?? '').toLowerCase() : '';
  const rule = RULES.find((r) => r.ext.includes(ext));
  const mimeOk =
    !!rule && (file.mimetype === rule.mime || ['', 'application/octet-stream'].includes(file.mimetype));

  if (!rule || !mimeOk) {
    throw new BadRequestException('Непідтримуваний тип файлу. Дозволено: PNG, JPG, WebP, PDF, DOCX, XLSX');
  }
  if (file.size > rule.maxMb * 1024 * 1024) {
    throw new BadRequestException(`Файл завеликий. Максимум ${rule.maxMb} МБ`);
  }
  if (!rule.magic(file.buffer)) {
    throw new BadRequestException('Вміст файлу не відповідає його типу');
  }
  return { rule, ext, name };
}