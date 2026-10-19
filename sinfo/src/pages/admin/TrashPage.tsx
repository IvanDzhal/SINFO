import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import { getErrorMessage } from '@/utils/errors'
import { usePageTitle } from '@/hooks/usePageTitle'

interface TrashData {
  days: number
  items: { id: string; title: string; type: string; trashedAt: string; daysLeft: number }[]
  tests: { id: string; title: string; trashedAt: string; daysLeft: number }[]
  categories: {
    id: string
    name: string
    parentId: string | null
    trashedAt: string
    daysLeft: number
  }[]
}

const TYPE_LABEL: Record<string, string> = {
  instruction: 'Інструкція',
  material: 'Матеріал',
  news: 'Новина',
}

interface Row {
  key: string
  title: string
  kind: string
  trashedAt: string
  daysLeft: number
  restore: () => Promise<unknown>
  purge: () => Promise<unknown>
}

export default function TrashPage() {
  usePageTitle('Кошик')
  const [data, setData] = useState<TrashData | null>(null)
  const [error, setError] = useState('')

  const load = () =>
    api
      .get<TrashData>('/admin/trash')
      .then((r) => setData(r.data))
      .catch(() => setError('Не вдалося завантажити кошик'))

  useEffect(() => {
    load()
  }, [])

  async function act(fn: () => Promise<unknown>) {
    try {
      await fn()
      await load()
    } catch (err) {
      window.alert(getErrorMessage(err, 'Не вдалося виконати дію'))
    }
  }

  if (error) return <p className="text-danger">{error}</p>
  if (!data) return <p className="text-muted">Завантаження...</p>

  const rows: Row[] = [
    ...data.items.map((i) => ({
      key: `item-${i.id}`,
      title: i.title,
      kind: TYPE_LABEL[i.type] ?? 'Матеріал',
      trashedAt: i.trashedAt,
      daysLeft: i.daysLeft,
      restore: () => api.post(`/knowledge/manage/items/${i.id}/restore`),
      purge: () => api.delete(`/knowledge/manage/items/${i.id}`),
    })),
    ...data.tests.map((t) => ({
      key: `test-${t.id}`,
      title: t.title,
      kind: 'Тест',
      trashedAt: t.trashedAt,
      daysLeft: t.daysLeft,
      restore: () => api.post(`/testing/manage/tests/${t.id}/restore`),
      purge: () => api.delete(`/testing/manage/tests/${t.id}`),
    })),
    ...data.categories.map((c) => ({
      key: `cat-${c.id}`,
      title: c.name,
      kind: c.parentId ? 'Підкатегорія' : 'Категорія',
      trashedAt: c.trashedAt,
      daysLeft: c.daysLeft,
      restore: () => api.patch(`/knowledge/categories/${c.id}/restore`),
      purge: () => api.delete(`/knowledge/categories/${c.id}/purge`),
    })),
  ].sort((a, b) => b.trashedAt.localeCompare(a.trashedAt))

  return (
    <div>
      <h2 className="mb-1 text-xl font-semibold">Кошик</h2>
      <p className="mb-4 text-sm text-muted">
        Видалене зберігається {data.days} днів, потім зникає остаточно. Тут його можна відновити.
      </p>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {rows.length === 0 && (
          <p className="px-4 py-8 text-center text-muted">Кошик порожній</p>
        )}
        {rows.map((r) => (
          <div
            key={r.key}
            className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 first:border-t-0"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{r.title}</p>
              <p className="text-xs text-muted">
                {r.kind} · видалено {new Date(r.trashedAt).toLocaleDateString('uk-UA')} · зникне через{' '}
                {r.daysLeft} дн.
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <button className="text-accent hover:underline" onClick={() => act(r.restore)}>
                Відновити
              </button>
              <button
                className="text-danger hover:underline"
                onClick={() => {
                  if (window.confirm(`Видалити «${r.title}» остаточно? Це не можна скасувати.`)) {
                    act(r.purge)
                  }
                }}
              >
                Видалити назавжди
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
