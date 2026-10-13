import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BookOpen } from 'lucide-react'
import clsx from 'clsx'
import { api } from '@/services/api'
import { getErrorMessage } from '@/utils/errors'
import TestStatusBadge, { type MyStatus } from '@/components/TestStatusBadge'

interface Attempt {
  id: string
  attemptNumber: number
  status: 'in_progress' | 'completed'
  startedAt: string
  completedAt: string | null
  timedOut: boolean
  score: number | null
  maxScore: number
  scorePercent: number | null
  passed: boolean | null
}

interface Detail {
  id: string
  title: string
  description: string
  isRequired: boolean
  deadline: string | null
  questionCount: number
  timeLimitMinutes: number
  passingScorePercent: number
  maxAttempts: number
  category: { id: string; name: string } | null
  linkedItem: { id: string; slug: string | null; title: string } | null
  myStatus: MyStatus
  attempts: Attempt[]
  inProgressAttemptId: string | null
  canStart: boolean
  blockedReason: string | null
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  )
}

export default function TestDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<Detail | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setData(null)
    api
      .get<Detail>(`/testing/tests/${id}`)
      .then((r) => setData(r.data))
      .catch(() => setError('Тест не знайдено або він вам не призначений'))
  }, [id])

  async function start() {
    if (!data) return
    if (!window.confirm(`Після початку піде таймер: ${data.timeLimitMinutes} хв. Почати тест?`)) return
    setBusy(true)
    setError('')
    try {
      const r = await api.post<{ attemptId: string }>(`/testing/tests/${data.id}/start`)
      navigate(`/testing/attempt/${r.data.attemptId}`)
    } catch (err) {
      setError(getErrorMessage(err, 'Не вдалося почати тест'))
      setBusy(false)
    }
  }

  if (error && !data) return <p className="text-danger">{error}</p>
  if (!data) return <p className="text-muted">Завантаження...</p>

  const overdue = data.deadline ? new Date(data.deadline).getTime() < Date.now() : false

  return (
    <div className="max-w-3xl">
      <Link
        to="/testing"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft size={16} /> Тестування
      </Link>

      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {data.category && (
            <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-muted">
              {data.category.name}
            </span>
          )}
          {data.isRequired && (
            <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
              Обов'язковий
            </span>
          )}
          <TestStatusBadge status={data.myStatus} />
        </div>

        <h2 className="text-2xl font-semibold">{data.title}</h2>
        {data.description && <p className="mt-2 text-muted">{data.description}</p>}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fact label="Питань" value={String(data.questionCount)} />
          <Fact label="Час" value={`${data.timeLimitMinutes} хв`} />
          <Fact label="Прохідний бал" value={`${data.passingScorePercent}%`} />
          <Fact
            label="Спроби"
            value={data.maxAttempts === 0 ? 'без обмежень' : `${data.attempts.length} з ${data.maxAttempts}`}
          />
        </div>

        {data.deadline && (
          <p className={clsx('mt-3 text-sm', overdue ? 'text-danger' : 'text-muted')}>
            {overdue ? 'Термін минув' : 'Пройти до'}{' '}
            {new Date(data.deadline).toLocaleString('uk-UA', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}

        {data.linkedItem && (
          <Link
            to={`/knowledge/${data.linkedItem.slug ?? data.linkedItem.id}`}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-surface-2"
          >
            <BookOpen size={16} className="text-accent" /> Матеріал для підготовки:{' '}
            {data.linkedItem.title}
          </Link>
        )}

        <div className="mt-5">
          {error && <p className="mb-2 text-sm text-danger">{error}</p>}
          {data.inProgressAttemptId ? (
            <button
              onClick={() => navigate(`/testing/attempt/${data.inProgressAttemptId}`)}
              className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              Продовжити тест
            </button>
          ) : data.canStart ? (
            <button
              onClick={start}
              disabled={busy}
              className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Запуск...' : 'Почати тест'}
            </button>
          ) : (
            <p className="text-sm text-muted">{data.blockedReason}</p>
          )}
        </div>
      </div>

      {data.attempts.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
          <p className="px-4 py-3 font-medium">Мої спроби</p>
          {data.attempts.map((a) => (
            <button
              key={a.id}
              onClick={() => navigate(`/testing/attempt/${a.id}`)}
              className="flex w-full items-center gap-3 border-t border-border px-4 py-3 text-left hover:bg-surface-2"
            >
              <span className="w-16 shrink-0 text-sm text-muted">Спроба {a.attemptNumber}</span>
              <span className="min-w-0 flex-1 text-sm">
                {new Date(a.startedAt).toLocaleString('uk-UA')}
              </span>
              {a.status === 'in_progress' ? (
                <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
                  В процесі
                </span>
              ) : (
                <>
                  <span className="text-sm font-medium">
                    {Math.floor(a.scorePercent ?? 0)}% · {a.score}/{a.maxScore}
                  </span>
                  <span
                    className={clsx(
                      'rounded-full px-2.5 py-0.5 text-xs font-medium',
                      a.passed ? 'bg-success-soft text-success' : 'bg-surface-2 text-danger',
                    )}
                  >
                    {a.passed ? 'Пройдено' : a.timedOut ? 'Час вичерпано' : 'Не пройдено'}
                  </span>
                </>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}