import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import clsx from 'clsx'
import { api } from '@/services/api'
import { useCan } from '@/hooks/useCan'
import Modal from '@/components/Modal'
import { getErrorMessage } from '@/utils/errors'
import TestStatusBadge, { type MyStatus } from '@/components/TestStatusBadge'

interface AttemptRow {
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
  timeSec: number | null
}

interface TestResult {
  test: {
    id: string
    title: string
    isRequired: boolean
    deadline: string | null
    passingScorePercent: number
  }
  status: MyStatus
  best: number | null
  attempts: AttemptRow[]
}

interface UserResults {
  user: { id: string; name: string; login: string; store: string | null; region: string | null }
  tests: TestResult[]
}

interface AnswersData {
  attempt: {
    id: string
    attemptNumber: number
    score: number | null
    maxScore: number
    scorePercent: number | null
    passed: boolean | null
    userName: string
    testTitle: string
  }
  items: {
    questionId: string
    type: string
    text: string
    points: number
    score: number
    isCorrect: boolean
    explanation: string
    userAnswer: string
    correctAnswer: string
  }[]
}

function fmtTime(sec: number | null) {
  if (sec === null) return '—'
  return `${Math.floor(sec / 60)} хв ${sec % 60} с`
}

function AnswersModal({
  attemptId,
  onClose,
  onChanged,
}: {
  attemptId: string
  onClose: () => void
  onChanged: () => void
}) {
  const can = useCan()
  const [data, setData] = useState<AnswersData | null>(null)
  const [error, setError] = useState('')

  const load = () =>
    api
      .get<AnswersData>(`/testing/analytics/attempts/${attemptId}/answers`)
      .then((r) => setData(r.data))
      .catch(() => setError('Не вдалося завантажити відповіді'))

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId])

  async function setScore(questionId: string, score: number) {
    try {
      await api.patch(`/testing/analytics/attempts/${attemptId}/answers/${questionId}`, { score })
      await load()
      onChanged()
    } catch (err) {
      window.alert(getErrorMessage(err, 'Не вдалося змінити бали'))
    }
  }

  return (
    <Modal
      title={data ? `${data.attempt.userName}: спроба ${data.attempt.attemptNumber}` : 'Відповіді'}
      onClose={onClose}
      wide
    >
      {error && <p className="text-danger">{error}</p>}
      {!data && !error && <p className="text-muted">Завантаження...</p>}
      {data && (
        <div>
          <p className="mb-3 text-sm text-muted">
            {data.attempt.testTitle} · {Math.floor(data.attempt.scorePercent ?? 0)}% ·{' '}
            {data.attempt.score}/{data.attempt.maxScore} балів
          </p>
          {data.items.map((it, i) => (
            <div key={it.questionId} className="border-t border-border py-3 first:border-t-0">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">
                  {i + 1}. {it.text}
                </p>
                <span
                  className={clsx(
                    'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium',
                    it.isCorrect ? 'bg-success-soft text-success' : 'bg-surface-2 text-danger',
                  )}
                >
                  {it.score}/{it.points}
                </span>
              </div>
              {can('testing.edit_results') && (
                <label className="mt-1 flex items-center gap-2 text-xs text-muted">
                  Бали вручну:
                  <select
                    value={it.score}
                    onChange={(e) => setScore(it.questionId, Number(e.target.value))}
                    className="rounded-lg border border-border bg-surface px-2 py-1 text-ink"
                  >
                    {Array.from({ length: it.points + 1 }, (_, n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p className="mt-1 whitespace-pre-wrap text-sm">
                <span className="text-muted">Відповідь: </span>
                {it.userAnswer}
              </p>
              {!it.isCorrect && (
                <p className="mt-1 whitespace-pre-wrap text-sm text-success">
                  <span className="text-muted">Правильно: </span>
                  {it.correctAnswer}
                </p>
              )}
              {it.explanation && <p className="mt-1 text-xs text-muted">{it.explanation}</p>}
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

export default function UserResultsDrawer({
  userId,
  onClose,
}: {
  userId: string
  onClose: () => void
}) {
  const can = useCan()
  const [data, setData] = useState<UserResults | null>(null)
  const [error, setError] = useState('')
  const [answers, setAnswers] = useState<string | null>(null)

  const load = () =>
    api
      .get<UserResults>(`/testing/analytics/users/${userId}`)
      .then((r) => setData(r.data))
      .catch(() => setError('Не вдалося завантажити результати'))

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function removeAttempt(a: AttemptRow) {
    if (!window.confirm(`Видалити спробу ${a.attemptNumber}? Результат зникне назавжди, а спроба знову стане доступною для проходження.`)) return
    try {
      await api.delete(`/testing/analytics/attempts/${a.id}`)
      await load()
    } catch (err) {
      window.alert(getErrorMessage(err, 'Не вдалося видалити спробу'))
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !answers && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
        <div
          className="flex h-full w-full flex-col bg-bg sm:max-w-3xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold">{data?.user.name ?? 'Результати'}</h2>
              {data && (
                <p className="truncate text-xs text-muted">
                  {data.user.login}
                  {data.user.store && ` · ${data.user.store}`}
                  {data.user.region && ` · ${data.user.region}`}
                </p>
              )}
            </div>
            <button onClick={onClose} aria-label="Закрити" className="shrink-0">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {error && <p className="text-danger">{error}</p>}
            {!data && !error && <p className="text-muted">Завантаження...</p>}
            {data && data.tests.length === 0 && <p className="text-muted">Тестів поки немає.</p>}
            {data?.tests.map((t) => (
              <section key={t.test.id} className="mb-4 rounded-2xl border border-border bg-surface">
                <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                  <h3 className="font-medium">{t.test.title}</h3>
                  <TestStatusBadge status={t.status} />
                  {t.test.isRequired && (
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">
                      Обов'язковий
                    </span>
                  )}
                  <span className="ml-auto text-sm text-muted">
                    Найкращий: {t.best === null ? '—' : `${Math.floor(t.best)}%`}
                  </span>
                </div>
                {t.attempts.length === 0 && (
                  <p className="border-t border-border px-4 py-3 text-sm text-muted">
                    Спроб ще не було
                  </p>
                )}
                {t.attempts.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-2.5 text-sm"
                  >
                    <span className="w-20 shrink-0 text-muted">Спроба {a.attemptNumber}</span>
                    <span className="min-w-0 flex-1 text-muted">
                      {new Date(a.startedAt).toLocaleString('uk-UA')}
                    </span>
                    {a.status === 'in_progress' ? (
                      <span className="text-accent">В процесі</span>
                    ) : (
                      <>
                        <span className="font-medium">
                          {Math.floor(a.scorePercent ?? 0)}% · {a.score}/{a.maxScore}
                        </span>
                        <span className="text-muted">{fmtTime(a.timeSec)}</span>
                        <span className={a.passed ? 'text-success' : 'text-danger'}>
                          {a.passed ? 'Пройдено' : a.timedOut ? 'Час вичерпано' : 'Не пройдено'}
                        </span>
                        {can('testing.view_answers') && (
                          <button
                            onClick={() => setAnswers(a.id)}
                            className="text-accent hover:underline"
                          >
                            Відповіді
                          </button>
                        )}
                      </>
                    )}
                    {can('testing.edit_results') && (
                      <button
                        onClick={() => removeAttempt(a)}
                        className="text-danger hover:underline"
                      >
                        Видалити
                      </button>
                    )}
                  </div>
                ))}
              </section>
            ))}
          </div>
        </div>
      </div>
      {answers && (
        <AnswersModal attemptId={answers} onClose={() => setAnswers(null)} onChanged={load} />
      )}
    </>
  )
}