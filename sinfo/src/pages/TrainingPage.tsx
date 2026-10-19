import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Lock,
  PlayCircle,
  Settings2,
  Type,
} from 'lucide-react'
import clsx from 'clsx'
import { api } from '@/services/api'
import { useCan } from '@/hooks/useCan'

interface Lesson {
  id: string
  slug: string | null
  kind: 'text' | 'video' | 'pdf'
  title: string
  done: boolean
}

interface Stage {
  id: string
  number: number
  title: string
  description: string
  state: 'locked' | 'open' | 'done'
  lessonsTotal: number
  lessonsDone: number
  lessons: Lesson[]
  test: {
    id: string
    slug: string | null
    title: string
    passingScorePercent: number
    passed: boolean
    attemptsUsed: number
    maxAttempts: number
    bestPercent: number | null
    available: boolean
  } | null
}

interface Overview {
  stages: Stage[]
  stagesTotal: number
  stagesDone: number
  percent: number
}

const KIND_ICON = { text: Type, video: PlayCircle, pdf: FileText }

export default function TrainingPage() {
  const can = useCan()
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get<Overview>('/training')
      .then((r) => setData(r.data))
      .catch(() => setError('Не вдалося завантажити навчання'))
  }, [])

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Навчання</h1>
        {(can('training.manage') || can('training.view_analytics')) && (
          <Link
            to="/training/manage"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-2"
          >
            <Settings2 size={16} /> Керування
          </Link>
        )}
      </div>

      {error && <p className="text-danger">{error}</p>}
      {!data && !error && <p className="text-muted">Завантаження…</p>}

      {data && data.stages.length === 0 && (
        <p className="rounded-2xl border border-border bg-surface p-5 text-muted">
          Програму навчання ще не опубліковано.
        </p>
      )}

      {data && data.stages.length > 0 && (
        <>
          <div className="mb-5 rounded-2xl border border-border bg-surface p-4">
            <div className="mb-2 flex justify-between text-sm">
              <span>
                Пройдено етапів: {data.stagesDone} з {data.stagesTotal}
              </span>
              <span className="font-medium">{data.percent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full bg-accent" style={{ width: `${data.percent}%` }} />
            </div>
          </div>

          <div className="space-y-4">
            {data.stages.map((s) => (
              <StageCard key={s.id} stage={s} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function StageCard({ stage: s }: { stage: Stage }) {
  const locked = s.state === 'locked'
  return (
    <section
      className={clsx(
        'rounded-2xl border bg-surface p-4',
        locked ? 'border-border opacity-60' : 'border-border',
        s.state === 'done' && 'border-accent',
      )}
    >
      <div className="mb-3 flex items-start gap-3">
        <div className="mt-0.5">
          {locked ? (
            <Lock size={20} className="text-muted" />
          ) : s.state === 'done' ? (
            <CheckCircle2 size={20} className="text-accent" />
          ) : (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs text-white">
              {s.number}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold">
            Етап {s.number}. {s.title}
          </h2>
          {s.description && <p className="mt-1 text-sm text-muted">{s.description}</p>}
          {locked && (
            <p className="mt-1 text-xs text-muted">Відкриється після проходження попереднього етапу</p>
          )}
        </div>
      </div>

      {!locked && (
        <ul className="space-y-1">
          {s.lessons.map((l) => {
            const Icon = KIND_ICON[l.kind]
            return (
              <li key={l.id}>
                <Link
                  to={`/training/lesson/${l.slug ?? l.id}`}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-surface-2"
                >
                  <Icon size={16} className="shrink-0 text-muted" />
                  <span className="flex-1">{l.title}</span>
                  {l.done && <CheckCircle2 size={16} className="text-accent" />}
                </Link>
              </li>
            )
          })}

          {s.test && (
            <li>
              {s.test.available ? (
                <Link
                  to={`/testing/${s.test.slug ?? s.test.id}`}
                  className="flex items-center gap-3 rounded-xl bg-accent-soft px-3 py-2 text-sm font-medium text-accent"
                >
                  <ClipboardCheck size={16} className="shrink-0" />
                  <span className="flex-1">
                    Тест: {s.test.title}
                    <span className="ml-2 font-normal text-muted">
                      прохідний {s.test.passingScorePercent}%
                      {s.test.bestPercent !== null && ` · найкращий ${Math.floor(s.test.bestPercent)}%`}
                    </span>
                  </span>
                  {s.test.passed && <CheckCircle2 size={16} />}
                </Link>
              ) : (
                <div className="flex items-center gap-3 px-3 py-2 text-sm text-muted">
                  <Lock size={16} className="shrink-0" />
                  Тест відкриється після опрацювання всіх матеріалів етапу
                </div>
              )}
            </li>
          )}
        </ul>
      )}
    </section>
  )
}
