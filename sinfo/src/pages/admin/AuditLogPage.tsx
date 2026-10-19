import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import { actionLabel, entityLabel } from '@/utils/auditLabels'
import { usePageTitle } from '@/hooks/usePageTitle'

interface AuditRow {
  id: string
  action: string
  entityType: string
  details: Record<string, unknown> | null
  createdAt: string
  actor: { login: string; firstName: string; lastName: string } | null
}

const PAGE = 50

const GROUPS: [string, string][] = [
  ['', 'Усі дії'],
  ['user.', 'Користувачі'],
  ['role.', 'Ролі'],
  ['knowledge_item.', 'Матеріали'],
  ['knowledge_category.', 'Категорії'],
  ['test.', 'Тести'],
  ['test_attempt.', 'Результати тестів'],
  ['test_question.', 'Питання тестів'],
  ['training.', 'Навчання'],
  ['datasource.', 'Джерела даних'],
  ['maintenance.', 'Технічні роботи'],
  ['store.', 'Магазини'],
  ['city.', 'Міста'],
  ['region.', 'Області'],
  ['brand.', 'Бренди'],
]

// Коротко про що запис: назва, логін тощо (технічні id не показуємо)
function detailsText(d: AuditRow['details']) {
  if (!d) return '—'
  const parts = ['title', 'name', 'login', 'test', 'from', 'to']
    .map((k) => d[k])
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
  return parts.length ? parts.join(' → ') : '—'
}

const input = 'rounded-xl border border-border bg-surface px-3 py-2 text-sm'

export default function AuditLogPage() {
  usePageTitle('Журнал дій')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [group, setGroup] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [rows, setRows] = useState<AuditRow[]>([])
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  function params(offset: number) {
    const p: Record<string, string> = { limit: String(PAGE), offset: String(offset) }
    if (debounced) p.search = debounced
    if (group) p.action = group
    if (from) p.dateFrom = new Date(`${from}T00:00:00`).toISOString()
    if (to) p.dateTo = new Date(`${to}T23:59:59`).toISOString()
    return p
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .get<AuditRow[]>('/admin/audit-log', { params: params(0) })
      .then((r) => {
        if (cancelled) return
        setRows(r.data)
        setMore(r.data.length === PAGE)
        setError('')
      })
      .catch(() => !cancelled && setError('Не вдалося завантажити журнал'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, group, from, to])

  async function loadMore() {
    try {
      const r = await api.get<AuditRow[]>('/admin/audit-log', { params: params(rows.length) })
      setRows((prev) => [...prev, ...r.data])
      setMore(r.data.length === PAGE)
    } catch {
      setError('Не вдалося завантажити ще')
    }
  }

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Журнал дій</h2>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Хто: ім'я або логін"
          className={`${input} w-full sm:w-60`}
        />
        <select value={group} onChange={(e) => setGroup(e.target.value)} className={input}>
          {GROUPS.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-sm text-muted">
          від
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={input} />
        </label>
        <label className="flex items-center gap-1 text-sm text-muted">
          до
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={input} />
        </label>
        {(search || group || from || to) && (
          <button
            className="px-2 text-sm text-muted hover:text-ink"
            onClick={() => {
              setSearch('')
              setGroup('')
              setFrom('')
              setTo('')
            }}
          >
            Скинути
          </button>
        )}
      </div>

      {error && <p className="mb-2 text-danger">{error}</p>}
      {loading && <p className="text-muted">Завантаження...</p>}
      {!loading && (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-160 text-sm">
            <thead className="bg-surface-2 text-left text-muted">
              <tr>
                {['Час', 'Хто', 'Дія', 'Деталі', "Об'єкт"].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-2.5">{new Date(r.createdAt).toLocaleString('uk-UA')}</td>
                  <td className="px-4 py-2.5">
                    {r.actor ? `${r.actor.firstName} ${r.actor.lastName}` : 'Система'}
                  </td>
                  <td className="px-4 py-2.5">{actionLabel(r.action)}</td>
                  <td className="px-4 py-2.5">{detailsText(r.details)}</td>
                  <td className="px-4 py-2.5">{entityLabel(r.entityType)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted">
                    Записів немає
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {!loading && more && (
        <div className="mt-3 text-center">
          <button
            onClick={loadMore}
            className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-surface-2"
          >
            Показати ще
          </button>
        </div>
      )}
    </div>
  )
}
