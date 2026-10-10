import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Clock, FileText } from 'lucide-react'
import clsx from 'clsx'
import { useFetch } from '@/hooks/useFetch'

type ItemType = 'instruction' | 'material'

interface Category {
  id: string
  name: string
  icon: string | null
  parentId: string | null
}

interface Item {
  id: string
  title: string
  description: string
  readingTimeMinutes: number
  isRequired: boolean
  updatedAt: string
  isRead: boolean
  category: Category | null
}

const TEXT: Record<ItemType, { title: string; subtitle: string }> = {
  instruction: {
    title: 'Інструкції',
    subtitle: 'Стандарти, регламенти та покрокові інструкції для роботи в магазині',
  },
  material: {
    title: 'Робочі матеріали',
    subtitle: 'Умови роботи, документи та корпоративні матеріали',
  },
}

const rootId = (i: Item) => (i.category ? (i.category.parentId ?? i.category.id) : null)

function plural(n: number) {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return 'стаття'
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'статті'
  return 'статей'
}

export default function KnowledgeListPage({ type }: { type: ItemType }) {
  const items = useFetch<Item>(`/knowledge/items?type=${type}`)
  const cats = useFetch<Category>('/knowledge/categories')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('new')

  const roots = useMemo(() => {
    const counts = new Map<string, number>()
    items.data.forEach((i) => {
      const r = rootId(i)
      if (r) counts.set(r, (counts.get(r) ?? 0) + 1)
    })
    return cats.data
      .filter((c) => !c.parentId && counts.has(c.id))
      .map((c) => ({ ...c, count: counts.get(c.id) ?? 0 }))
  }, [items.data, cats.data])

  const visible = useMemo(() => {
    let list = items.data
    if (filter === 'unread') list = list.filter((i) => !i.isRead)
    else if (filter !== 'all') list = list.filter((i) => rootId(i) === filter)
    return [...list].sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title, 'uk')
      const diff = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      return sort === 'old' ? -diff : diff
    })
  }, [items.data, filter, sort])

  const chips = [
    { key: 'all', label: 'Усі' },
    { key: 'unread', label: 'Непрочитані' },
    ...roots.map((c) => ({ key: c.id, label: c.name })),
  ]

  return (
    <div>
      <h2 className="text-xl font-semibold">{TEXT[type].title}</h2>
      <p className="mb-5 text-sm text-muted">{TEXT[type].subtitle}</p>

      {roots.length > 0 && (
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {roots.map((c) => (
            <button
              key={c.id}
              onClick={() => setFilter(filter === c.id ? 'all' : c.id)}
              className={clsx(
                'flex items-center gap-3 rounded-2xl border bg-surface p-4 text-left hover:border-accent',
                filter === c.id ? 'border-accent' : 'border-border',
              )}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-lg">
                {c.icon ?? '📁'}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">{c.name}</p>
                <p className="text-sm text-muted">
                  {c.count} {plural(c.count)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              className={clsx(
                'rounded-full border px-3 py-1 text-sm',
                filter === c.key
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-border bg-surface hover:bg-surface-2',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          Сортувати:
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-xl border border-border bg-surface px-2 py-1 text-sm text-accent outline-none"
          >
            <option value="new">Спочатку нові</option>
            <option value="old">Спочатку старі</option>
            <option value="title">За назвою</option>
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {items.loading && <p className="px-4 py-6 text-center text-muted">Завантаження...</p>}
        {items.error && <p className="px-4 py-6 text-center text-danger">{items.error}</p>}
        {!items.loading && !items.error && visible.length === 0 && (
          <p className="px-4 py-6 text-center text-muted">Поки нічого немає</p>
        )}
        {visible.map((i) => (
          <Link
            key={i.id}
            to={`/knowledge/${i.id}`}
            className="flex items-center gap-3 border-t border-border px-4 py-3 first:border-t-0 hover:bg-surface-2"
          >
            <span
              className={clsx(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                i.isRead ? 'bg-success-soft text-success' : 'bg-surface-2 text-muted',
              )}
            >
              {i.isRead ? <Check size={18} /> : <FileText size={18} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{i.title}</p>
              <p className="truncate text-sm text-muted">{i.description}</p>
            </div>
            {i.isRequired && !i.isRead && (
              <span className="hidden shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent sm:inline">
                Обов'язково
              </span>
            )}
            {i.category && (
              <span className="hidden shrink-0 rounded-md bg-surface-2 px-2 py-0.5 text-xs text-muted md:inline">
                {i.category.name}
              </span>
            )}
            <span className="hidden shrink-0 items-center gap-1 text-xs text-muted md:flex">
              <Clock size={14} /> {i.readingTimeMinutes} хв
            </span>
            <span className="hidden shrink-0 text-xs text-muted lg:inline">
              {new Date(i.updatedAt).toLocaleDateString('uk-UA')}
            </span>
            <span
              className={clsx(
                'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium',
                i.isRead ? 'bg-success-soft text-success' : 'bg-surface-2 text-muted',
              )}
            >
              {i.isRead ? 'Прочитано' : 'Не прочитано'}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}