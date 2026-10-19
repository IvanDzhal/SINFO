import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/services/api'
import { getErrorMessage } from '@/utils/errors'
import { usePageTitle } from '@/hooks/usePageTitle'

interface Row {
  id: string
  kind: string
  comment: string
  status: 'open' | 'resolved'
  createdAt: string
  item: { id: string; slug: string | null; title: string }
  author: string
  login: string
}

const KIND: Record<string, string> = {
  outdated: 'Застаріла інформація',
  error: 'Є помилка',
  unclear: 'Незрозуміло',
  other: 'Інше',
}

export default function FeedbackPage() {
  usePageTitle('Відгуки до матеріалів')
  const [status, setStatus] = useState<'open' | 'resolved'>('open')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState('')

  const load = () =>
    api
      .get<Row[]>('/knowledge/feedback', { params: { status } })
      .then((r) => setRows(r.data))
      .catch(() => setError('Не вдалося завантажити відгуки'))

  useEffect(() => {
    setRows(null)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  async function toggle(r: Row) {
    try {
      await api.patch(`/knowledge/feedback/${r.id}/${r.status === 'open' ? 'resolve' : 'reopen'}`)
      await load()
    } catch (err) {
      window.alert(getErrorMessage(err, 'Не вдалося змінити статус'))
    }
  }

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Відгуки до матеріалів</h2>
      <div className="mb-4 flex gap-2">
        {(['open', 'resolved'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full border px-3 py-1 text-sm ${
              status === s ? 'border-accent bg-accent-soft text-accent' : 'border-border text-muted'
            }`}
          >
            {s === 'open' ? 'Відкриті' : 'Опрацьовані'}
          </button>
        ))}
      </div>
      {error && <p className="text-danger">{error}</p>}
      {!rows && !error && <p className="text-muted">Завантаження...</p>}
      {rows && (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          {rows.length === 0 && <p className="px-4 py-8 text-center text-muted">Відгуків немає</p>}
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-start justify-between gap-3 border-t border-border px-4 py-3 first:border-t-0"
            >
              <div className="min-w-0">
                <Link
                  to={`/knowledge/${r.item.slug ?? r.item.id}`}
                  className="font-medium text-accent hover:underline"
                >
                  {r.item.title}
                </Link>
                <p className="text-sm">
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">
                    {KIND[r.kind] ?? r.kind}
                  </span>{' '}
                  {r.comment}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {r.author} ({r.login}) · {new Date(r.createdAt).toLocaleString('uk-UA')}
                </p>
              </div>
              <button className="shrink-0 text-sm text-accent hover:underline" onClick={() => toggle(r)}>
                {r.status === 'open' ? 'Опрацьовано' : 'Відкрити знову'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
