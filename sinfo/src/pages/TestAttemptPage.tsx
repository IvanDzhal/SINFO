import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import axios from 'axios'
import { Clock } from 'lucide-react'
import clsx from 'clsx'
import { api } from '@/services/api'
import { getErrorMessage } from '@/utils/errors'
import { usePageTitle } from '@/hooks/usePageTitle'

interface RQuestion {
  id: string
  type: 'single' | 'multiple' | 'matching' | 'input'
  text: string
  points: number
  options?: { id: string; label: string }[]
  left?: { id: string; label: string }[]
  right?: { id: string; label: string }[]
  inputKind?: 'text' | 'number'
}

interface InProgress {
  state: 'in_progress'
  attemptId: string
  attemptNumber: number
  test: { id: string; title: string }
  expiresAt: string
  serverNow: string
  questions: RQuestion[]
  answers: Record<string, unknown>
}

interface Completed {
  state: 'completed'
  attemptId: string
  attemptNumber: number
  test: { id: string; slug: string | null; title: string; passingScorePercent: number; maxAttempts: number }
  score: number | null
  maxScore: number
  scorePercent: number | null
  passed: boolean | null
  timedOut: boolean
  timeSpentSec: number
  attemptsUsed: number
  attemptsAllowed: number
}

type AttemptState = InProgress | Completed

function isAnswered(v: unknown) {
  if (v === null || v === undefined || v === '') return false
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'object') return Object.keys(v as object).length > 0
  return true
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function Result({ r }: { r: Completed }) {
  const percent = Math.floor(r.scorePercent ?? 0)
  const m = Math.floor(r.timeSpentSec / 60)
  const s = r.timeSpentSec % 60
  const canRetry = (r.attemptsAllowed === 0 || r.attemptsUsed < r.attemptsAllowed)

  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <p className="text-sm text-muted">{r.test.title}</p>
        <p
          className={clsx('mt-3 text-6xl font-semibold', r.passed ? 'text-success' : 'text-danger')}
        >
          {percent}%
        </p>
        <p className="mt-2 text-lg font-medium">{r.passed ? 'Тест пройдено' : 'Тест не пройдено'}</p>
        {r.timedOut && <p className="mt-1 text-sm text-muted">Час вичерпано, тест завершено автоматично</p>}

        <div className="mt-5 grid grid-cols-3 gap-3 text-left">
          <div className="rounded-xl bg-surface-2 px-3 py-2">
            <p className="text-xs text-muted">Бали</p>
            <p className="text-sm font-medium">
              {r.score ?? 0} з {r.maxScore}
            </p>
          </div>
          <div className="rounded-xl bg-surface-2 px-3 py-2">
            <p className="text-xs text-muted">Спроба</p>
            <p className="text-sm font-medium">
              {r.attemptsAllowed === 0 ? r.attemptsUsed : `${r.attemptsUsed} з ${r.attemptsAllowed}`}
            </p>
          </div>
          <div className="rounded-xl bg-surface-2 px-3 py-2">
            <p className="text-xs text-muted">Час</p>
            <p className="text-sm font-medium">
              {m} хв {s} с
            </p>
          </div>
        </div>

        <p className="mt-4 text-xs text-muted">Прохідний бал: {r.test.passingScorePercent}%</p>

        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            to={`/testing/${r.test.slug ?? r.test.id}`}
            className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-surface-2"
          >
            {canRetry ? 'До тесту (можна спробувати ще раз)' : 'До тесту'}
          </Link>
          <Link
            to="/testing"
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Усі тести
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function TestAttemptPage() {
  const { attemptId } = useParams()
  const [state, setState] = useState<AttemptState | null>(null)
  usePageTitle(state?.test.title)
  const [error, setError] = useState('')
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [remaining, setRemaining] = useState<number | null>(null)
  const [finishing, setFinishing] = useState(false)
  const offset = useRef(0)
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const latest = useRef<Record<string, unknown>>({})
  const busy = useRef(false)

  async function load() {
    try {
      const r = await api.get<AttemptState>(`/testing/attempts/${attemptId}`)
      setState(r.data)
      if (r.data.state === 'in_progress') {
        offset.current = new Date(r.data.serverNow).getTime() - Date.now()
        setAnswers(r.data.answers)
        latest.current = { ...r.data.answers }
      }
    } catch {
      setError('Спробу не знайдено')
    }
  }

  useEffect(() => {
    load()
    return () => {
      // не губимо відповіді, які ще не встигли відправитись
      Object.keys(timers.current).forEach((q) => {
        clearTimeout(timers.current[q])
        api
          .put(`/testing/attempts/${attemptId}/answers/${q}`, { answer: latest.current[q] ?? null })
          .catch(() => {})
      })
      timers.current = {}
    }
  }, [attemptId])

  async function save(qid: string, value: unknown) {
    setSaveState('saving')
    try {
      await api.put(`/testing/attempts/${attemptId}/answers/${qid}`, { answer: value ?? null })
      setSaveState('saved')
    } catch (err) {
      setSaveState('error')
      // час міг вичерпатися, тоді сервер уже завершив спробу
      if (axios.isAxiosError(err) && err.response?.status === 400) load()
    }
  }

  function setAnswer(qid: string, value: unknown, delay = 400) {
    setAnswers((a) => ({ ...a, [qid]: value }))
    latest.current[qid] = value
    clearTimeout(timers.current[qid])
    timers.current[qid] = setTimeout(() => {
      delete timers.current[qid]
      save(qid, value)
    }, delay)
  }

  async function flush() {
    const pending = Object.keys(timers.current)
    pending.forEach((q) => clearTimeout(timers.current[q]))
    timers.current = {}
    await Promise.all(pending.map((q) => save(q, latest.current[q])))
  }

  async function finish() {
    if (busy.current) return
    busy.current = true
    setFinishing(true)
    try {
      await flush()
      const r = await api.post<AttemptState>(`/testing/attempts/${attemptId}/finish`)
      setState(r.data)
    } catch (err) {
      setError(getErrorMessage(err, 'Не вдалося завершити тест'))
    } finally {
      busy.current = false
      setFinishing(false)
    }
  }

  useEffect(() => {
    if (!state || state.state !== 'in_progress') return
    const end = new Date(state.expiresAt).getTime()
    let timer: ReturnType<typeof setInterval> | undefined
    const tick = () => {
      const left = Math.max(0, Math.round((end - (Date.now() + offset.current)) / 1000))
      setRemaining(left)
      if (left <= 0) {
        if (timer) clearInterval(timer)
        finish()
      }
    }
    tick()
    timer = setInterval(tick, 1000)
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [state])

  if (error && !state) return <p className="text-danger">{error}</p>
  if (!state) return <p className="text-muted">Завантаження...</p>
  if (state.state === 'completed') return <Result r={state} />

  const questions = state.questions
  const q = questions[current]
  const unanswered = questions.filter((x) => !isAnswered(answers[x.id])).length

  function confirmFinish() {
    const text =
      unanswered > 0
        ? `Без відповіді: ${unanswered}. Завершити тест?`
        : 'Завершити тест і побачити результат?'
    if (window.confirm(text)) finish()
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="sticky top-[60px] z-10 -mx-4 mb-4 flex items-center justify-between gap-3 border-b border-border bg-bg px-4 py-3 lg:-mx-6 lg:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{state.test.title}</p>
          <p className="text-xs text-muted">
            Питання {current + 1} з {questions.length}
            {saveState === 'saving' && ' · збереження...'}
            {saveState === 'saved' && ' · збережено'}
            {saveState === 'error' && ' · не вдалося зберегти'}
          </p>
        </div>
        <div
          className={clsx(
            'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium',
            remaining !== null && remaining <= 60
              ? 'border-danger text-danger'
              : 'border-border text-ink',
          )}
        >
          <Clock size={14} /> {remaining === null ? '--:--' : formatTime(remaining)}
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <p className="mb-1 text-xs text-muted">{q.points} бал.</p>
        <p className="mb-4 whitespace-pre-wrap text-lg font-medium">{q.text}</p>

        {q.type === 'single' && (
          <div className="space-y-2">
            {q.options?.map((o) => (
              <label
                key={o.id}
                className={clsx(
                  'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm',
                  answers[q.id] === o.id ? 'border-accent bg-accent-soft' : 'border-border bg-surface',
                )}
              >
                <input
                  type="radio"
                  name={q.id}
                  className="mt-0.5"
                  checked={answers[q.id] === o.id}
                  onChange={() => setAnswer(q.id, o.id, 0)}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        )}

        {q.type === 'multiple' && (
          <div className="space-y-2">
            <p className="text-xs text-muted">Оберіть усі правильні варіанти</p>
            {q.options?.map((o) => {
              const picked = (answers[q.id] as string[] | undefined) ?? []
              const on = picked.includes(o.id)
              return (
                <label
                  key={o.id}
                  className={clsx(
                    'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm',
                    on ? 'border-accent bg-accent-soft' : 'border-border bg-surface',
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={on}
                    onChange={() =>
                      setAnswer(
                        q.id,
                        on ? picked.filter((x) => x !== o.id) : [...picked, o.id],
                        0,
                      )
                    }
                  />
                  <span>{o.label}</span>
                </label>
              )
            })}
          </div>
        )}

        {q.type === 'matching' && (
          <div className="space-y-3">
            <p className="text-xs text-muted">Підберіть до кожного пункту правильну пару</p>
            {q.left?.map((l) => {
              const map = (answers[q.id] as Record<string, string> | undefined) ?? {}
              return (
                <div key={l.id} className="grid gap-2 sm:grid-cols-2 sm:items-center">
                  <p className="text-sm">{l.label}</p>
                  <select
                    className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                    value={map[l.id] ?? ''}
                    onChange={(e) => setAnswer(q.id, { ...map, [l.id]: e.target.value }, 0)}
                  >
                    <option value="">— оберіть —</option>
                    {q.right?.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        )}

        {q.type === 'input' && (
          <input
            className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            placeholder={q.inputKind === 'number' ? 'Введіть число' : 'Введіть відповідь'}
            inputMode={q.inputKind === 'number' ? 'decimal' : 'text'}
            value={(answers[q.id] as string | undefined) ?? ''}
            onChange={(e) => setAnswer(q.id, e.target.value, 600)}
          />
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
          className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-surface-2 disabled:opacity-40"
        >
          Назад
        </button>
        {current < questions.length - 1 ? (
          <button
            onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Далі
          </button>
        ) : (
          <button
            onClick={confirmFinish}
            disabled={finishing}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Завершити тест
          </button>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
        <p className="mb-2 text-xs text-muted">Питання (зафарбовані мають відповідь)</p>
        <div className="flex flex-wrap gap-2">
          {questions.map((x, i) => (
            <button
              key={x.id}
              onClick={() => setCurrent(i)}
              className={clsx(
                'h-8 w-8 rounded-lg border text-sm',
                i === current ? 'border-accent text-accent' : 'border-border',
                isAnswered(answers[x.id]) && 'bg-accent-soft',
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <button
          onClick={confirmFinish}
          disabled={finishing}
          className="mt-4 text-sm text-accent hover:underline disabled:opacity-50"
        >
          Завершити тест достроково
        </button>
      </div>
    </div>
  )
}