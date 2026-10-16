import { matchPath } from 'react-router-dom'

export const APP_NAME = 'Слухавка Інфо'

// Порядок важливий: специфічніші шляхи — перед загальними
const TITLES: { path: string; title: string }[] = [
  { path: '/login', title: 'Вхід' },
  { path: '/', title: 'Головна' },
  { path: '/instructions', title: 'Інструкції' },
  { path: '/news', title: 'Новини' },
  { path: '/materials', title: 'Матеріали' },
  { path: '/knowledge/new', title: 'Нова публікація' },
  { path: '/knowledge/:id/edit', title: 'Редагування публікації' },
  { path: '/knowledge/:id', title: 'Публікація' },
  { path: '/testing', title: 'Тестування' },
  { path: '/testing/analytics', title: 'Аналітика тестування' },
  { path: '/testing/attempt/:attemptId', title: 'Проходження тесту' },
  { path: '/testing/:id', title: 'Тест' },
  { path: '/training', title: 'Навчання' },
  { path: '/training/manage', title: 'Керування навчанням' },
  { path: '/training/lesson/:id', title: 'Урок' },
  { path: '/analytics', title: 'Аналітика' },
  { path: '/about', title: 'Про проєкт' },
  { path: '/profile', title: 'Мій профіль' },
  { path: '/profile/settings', title: 'Налаштування профілю' },
  { path: '/profile/:id', title: 'Профіль' },
  { path: '/admin', title: 'Адмінка: Дашборд' },
  { path: '/admin/users', title: 'Адмінка: Користувачі' },
  { path: '/admin/users/:id', title: 'Адмінка: Користувач' },
  { path: '/admin/regions', title: 'Адмінка: Регіони' },
  { path: '/admin/cities', title: 'Адмінка: Міста' },
  { path: '/admin/stores', title: 'Адмінка: Магазини' },
  { path: '/admin/brands', title: 'Адмінка: Бренди' },
  { path: '/admin/roles', title: 'Адмінка: Ролі' },
  { path: '/admin/roles/:id', title: 'Адмінка: Роль' },
  { path: '/admin/audit-log', title: 'Адмінка: Журнал дій' },
  { path: '/admin/data-sync', title: 'Адмінка: Синхронізація даних' },
  { path: '/admin/data-sync/:id', title: 'Адмінка: Джерело даних' },
  { path: '/admin/knowledge/categories', title: 'Адмінка: Категорії' },
]

export function titleFor(pathname: string): string {
  const hit = TITLES.find((t) => matchPath({ path: t.path, end: true }, pathname))
  return hit ? `${APP_NAME} - ${hit.title}` : APP_NAME
}
