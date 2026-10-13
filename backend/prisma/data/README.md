# prisma/data

`legacy-shops.ts` — одноразовий імпорт розташування комірок і ID таблиць зі старого Telegram-бота
(`config/shops.py`). **У git не потрапляє** (див. `.gitignore`): репозиторій публічний, а ID таблиць
не варто публікувати.

Формат:

```ts
export const LEGACY_SHOPS: Record<string, {
  name: string
  sheetId: string
  sheetName: string | null
  mappings: Record<string, string[]>   // 'plan.TO' -> ['C5'], 'fact.TO' -> ['J5', 'K5']
}> = { ... }
```

Без цього файлу `seed-sales.ts` лише створює права й метрики. Таблиці можна підключати вручну в
адмінці: **Синхронізація даних → Підключити таблицю**.
