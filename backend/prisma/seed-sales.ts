import { PrismaClient, Scope } from '@prisma/client';

type LegacyShops = Record<
  string,
  { name: string; sheetId: string; sheetName: string | null; mappings: Record<string, string[]> }
>;

// ID таблиць не зберігаємо в git (репозиторій публічний): файл лежить лише локально
// і описаний у prisma/data/README.md
function loadLegacyShops(): LegacyShops | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./data/legacy-shops').LEGACY_SHOPS as LegacyShops;
  } catch {
    return null;
  }
}

// Ідемпотентний сид для Data Sync і Sales Analytics:
//  • права datasync.* (видаються ролі «Адмін»)
//  • метрики та їх кольорові пороги (значення з боту; існуючі налаштування не перезаписуються)
//  • магазини з боту (якщо ще немає), джерела таблиць і mapping комірок
// Запуск: npx ts-node prisma/seed-sales.ts

const prisma = new PrismaClient();

const PERMISSIONS = ['datasync.view', 'datasync.manage', 'datasync.run'];

// Рівні: critical < bad < warn < good < excellent. Умови перевіряються зверху вниз,
// остання смуга без умови — запасна.
const COMPLETION = {
  bands: [
    { gte: 100, level: 'good' },
    { gte: 80, level: 'warn' },
    { gte: 50, level: 'bad' },
    { level: 'critical' },
  ],
};

const METRICS = [
  { code: 'TO', name: 'Товарооборот', shortName: 'ТО', order: 1 },
  { code: 'MT', name: 'Мобільні телефони', shortName: 'МТ', order: 2 },
  { code: 'ACCESSORIES', name: 'Аксесуари', shortName: 'Акс', order: 3 },
  { code: 'SERVICES', name: 'Послуги', shortName: 'Послуги', order: 4 },
  { code: 'WARRANTY', name: 'Гарантія', shortName: 'Гарантія', order: 5 },
].map((m) => ({
  code: m.code,
  name: m.name,
  shortName: m.shortName,
  kind: 'base',
  unit: 'currency',
  numerator: null as string | null,
  denominator: null as string | null,
  thresholds: COMPLETION as object | null,
  displayOrder: m.order,
}));

const EFFICIENCY = [
  {
    code: 'SERVICES_EFFICIENCY',
    name: 'Ефективність послуг',
    shortName: 'Послуги/МТ',
    numerator: 'SERVICES',
    denominator: 'MT',
    // EFFICIENCY_THRESHOLDS.services зі старого боту
    thresholds: {
      bands: [
        { lte: 7.99, level: 'critical' },
        { lte: 9.99, level: 'warn' },
        { lte: 14.99, level: 'good' },
        { level: 'excellent' },
      ],
    },
    displayOrder: 10,
  },
  {
    code: 'WARRANTY_EFFICIENCY',
    name: 'Ефективність гарантії',
    shortName: 'Гарантія/МТ',
    numerator: 'WARRANTY',
    denominator: 'MT',
    // EFFICIENCY_THRESHOLDS.guarantee зі старого боту
    thresholds: {
      bands: [{ lt: 3.0, level: 'critical' }, { lt: 7.49, level: 'bad' }, { level: 'good' }],
    },
    displayOrder: 11,
  },
  {
    code: 'ACCESSORIES_EFFICIENCY',
    name: 'Ефективність аксесуарів',
    shortName: 'Акс/МТ',
    numerator: 'ACCESSORIES',
    denominator: 'MT',
    thresholds: null,
    displayOrder: 12,
  },
].map((m) => ({ ...m, kind: 'efficiency', unit: 'percent' }));

async function seedPermissions() {
  const admin = await prisma.role.findUnique({ where: { name: 'Адмін' } });
  for (const code of PERMISSIONS) {
    const p = await prisma.permission.upsert({ where: { code }, update: {}, create: { code } });
    if (!admin) continue;
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId_scope: { roleId: admin.id, permissionId: p.id, scope: Scope.GLOBAL },
      },
      update: {},
      create: { roleId: admin.id, permissionId: p.id, scope: Scope.GLOBAL },
    });
  }
}

async function seedMetrics() {
  for (const m of [...METRICS, ...EFFICIENCY]) {
    await prisma.salesMetricDef.upsert({
      where: { code: m.code },
      update: {}, // налаштування адміністратора не перезаписуємо
      create: { ...m, thresholds: m.thresholds ?? undefined },
    });
  }
}

async function placeholderPlace() {
  const region = await prisma.region.upsert({
    where: { name: 'Не визначено' },
    update: {},
    create: { name: 'Не визначено' },
  });
  let city = await prisma.city.findFirst({ where: { name: 'Не визначено', regionId: region.id } });
  if (!city) city = await prisma.city.create({ data: { name: 'Не визначено', regionId: region.id } });
  return { region, city };
}

async function brandFor(shopName: string) {
  const name = /lifecell/i.test(shopName) ? 'lifecell' : 'Слухавка';
  return prisma.brandFormat.upsert({ where: { name }, update: {}, create: { name } });
}

async function seedStores() {
  const shops = loadLegacyShops();
  if (!shops) {
    console.log('prisma/data/legacy-shops.ts не знайдено — магазини й mapping пропущено');
    return [];
  }
  const place = await placeholderPlace();
  const created: string[] = [];

  for (const [code, shop] of Object.entries(shops)) {
    let store = await prisma.store.findUnique({ where: { code } });

    // уже наявні магазини, створені вручну до появи коду
    if (!store && code === 'СТЛ') store = await prisma.store.findFirst({ where: { name: 'СТЛ' } });
    if (!store && code === 'СНТ') {
      store = await prisma.store.findFirst({ where: { city: { name: 'Снятин' }, code: null } });
    }

    if (store && store.code !== code) {
      store = await prisma.store.update({ where: { id: store.id }, data: { code } });
    }

    if (!store) {
      const brand = await brandFor(shop.name);
      store = await prisma.store.create({
        data: {
          name: shop.name,
          code,
          regionId: place.region.id,
          cityId: place.city.id,
          brandFormatId: brand.id,
        },
      });
      created.push(code);
    }

    const source = await prisma.dataSource.upsert({
      where: { storeId: store.id },
      update: {},
      create: { storeId: store.id, externalId: shop.sheetId, sheetName: shop.sheetName },
    });

    for (const [key, cells] of Object.entries(shop.mappings)) {
      await prisma.dataMapping.upsert({
        where: { sourceId_key: { sourceId: source.id, key } },
        update: {}, // ручні правки mapping у адмінці не затираємо
        create: { sourceId: source.id, key, cells },
      });
    }
  }
  return created;
}

async function main() {
  await seedPermissions();
  await seedMetrics();
  const created = await seedStores();
  console.log(`Метрик: ${METRICS.length + EFFICIENCY.length}. Нових магазинів: ${created.length}`);
  if (created.length) {
    console.log(`Створено з областю/містом «Не визначено» — призначте в адмінці: ${created.join(', ')}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
