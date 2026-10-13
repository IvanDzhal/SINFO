# Data Sync і Sales Analytics — як це працює

Реалізація `DATA_SYNC_v1.1.md` та Sales-гілки `ANALYTICS_v1.md`.

```
Google Sheets → [Connector → Mapping → Normalizer → Validator → Writer] → PostgreSQL → Sales Analytics → Web
                        backend/src/datasync                                   backend/src/analytics/sales
```

## Запуск

1. Ключ service account: `secrets/google-service-account.json` (див. `secrets/README.md`).
2. Таблиці магазинів відкрити для `client_email` з ключа (доступ «Переглядач»).
3. Застосувати зміни: `docker compose up -d backend`.
4. Одноразово наповнити довідники й mapping зі старого бота:
   `docker exec sinfo_backend npx ts-node prisma/seed-sales.ts` (ідемпотентний; ручні правки не затирає).
   Дані таблиць беруться з локального `backend/prisma/data/legacy-shops.ts` (не в git, див. README там).
   Без нього сид створює лише права й метрики, а таблиці підключаються в адмінці.
5. Адмінка → **Синхронізація даних** → «Синхронізувати все».

## Розклад

BullMQ (Redis), час Київський: щогодини 09:00–20:00 та о 21:05. Повтори при тимчасових помилках:
3 спроби з експоненційною паузою. Ручний запуск: кнопка в адмінці (на магазин або на всі).

## Модель даних

| Таблиця | Призначення |
|---|---|
| `DataSource` | таблиця магазину (`externalId`, аркуш, статус, час синхронізацій) |
| `DataMapping` | ключ → список комірок A1 (підсумовуються) |
| `SalesMetricDef` | метрики, формули ефективності, **кольорові пороги** |
| `SyncRun` | журнал запусків (статус, лічильники, помилки) |
| `SalesSnapshot` | зріз магазину на дату: днів минуло/залишилось, raw-значення |
| `SalesMetric` | `plan`, `fact` (накопичувально за місяць), `dayFact` на дату |

Ключі mapping: `plan.TO`, `fact.TO`, `day.TO`, … (`TO MT ACCESSORIES SERVICES WARRANTY`),
`meta.days_passed`, `meta.days_left`. Нову метрику додає запис у `SalesMetricDef` — код дашбордів
змінювати не потрібно.

Історія: кожна синхронізація пише запис на дату за Києвом (upsert), тому скидання таблиці на початку
місяця історію не стирає.

## Валідація

Нечислове значення, порожня комірка, від'ємні plan/fact, некоректна кількість днів — помилка в
`SyncRun`, значення **не** перетворюється на 0 (відмінність від старого бота). Статуси:
`success` / `partial` (частина метрик збережена) / `failed`.

## Кольорова градація

Пороги з `config/shops.py` бота лежать в `SalesMetricDef.thresholds`:

- послуги/МТ: ≤7.99 critical, ≤9.99 warn, ≤14.99 good, далі excellent
- гарантія/МТ: <3.0 critical, <7.49 bad, далі good
- виконання плану й прогноз: ≥100 good, ≥80 warn, ≥50 bad, нижче critical

Змінити можна через `PATCH /api/analytics/sales/metrics/:code` (адмін).

## Права

| Право | Дає |
|---|---|
| `datasync.view` | перегляд джерел і журналу |
| `datasync.manage` | підключення таблиць, mapping |
| `datasync.run` | ручний запуск синхронізації |
| `analytics.sales.view` | Sales Analytics у межах scope (GLOBAL / REGION / STORE) |

Права `datasync.*` потребують scope GLOBAL. Права `analytics.sales.view_region/view_store/view_employee`
наразі не розрізняються — доступ визначає scope права `analytics.sales.view`.

## Що навмисно не перенесено

KPI-бонуси (`KPI_BONUS_*`, `calculate_kpi`), Telegram-форматування, ранковий брифінг — поза Data Sync
і Sales Analytics (DATA_SYNC §4). Бот у майбутньому має споживати `/api/analytics/sales/*`.
