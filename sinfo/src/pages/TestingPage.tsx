import { useState } from 'react'
import { Clock, Plus } from 'lucide-react'
import clsx from 'clsx'
import { useFetch } from '@/hooks/useFetch'
import { useCan } from '@/hooks/useCan'
import TestEditorDrawer from '@/components/TestEditorDrawer'
import { Link } from 'react-router-dom'
import TestStatusBadge, { type MyStatus } from '@/components/TestStatusBadge'

type Mode = 'published' | 'draft' | 'archived'

interface Category {
  id: string
  name: string
  icon: string | null
}

interface AvailableTest {
  id: string
  slug: string | null
  title: string
  description: string
  isRequired: boolean
  deadline: string | null
  questionCount: number
  timeLimitMinutes: number
  passingScorePercent: number
  maxAttempts: number
  category: Category | null
  myStatus: MyStatus
  attemptsUsed: number
  bestPercent: number | null
  inProgressAttemptId: string | null
}

interface ManageRow {
  id: string
  title: string
  description: string
  status: string
  isRequired: boolean
  deadline: string | null
  questionCount: number
  updatedAt: string
  category: Category | null
  _count: { questions: number }
}

const MODES: { key: Mode; label: string }[] = [
  { key: 'published', label: 'Опубліковані' },
  { key: 'draft', label: 'Чернетки' },
  { key: 'archived', label: 'Архів' },
]

function formatDeadline(iso: string) {
  return new Date(iso).toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Deadline({ iso }: { iso: string | null }) {
  if (!iso) return null
  const overdue = new Date(iso).getTime() < Date.now()
  return (
    <span className={clsx('text-xs', overdue ? 'text-danger' : 'text-muted')}>
      {overdue ? 'Термін минув' : 'До'} {formatDeadline(iso)}
    </span>
  )
}

function ManageSection() {
  const can = useCan()
  const [mode, setMode] = useState<Mode>('published')
  const { data, loading, error, reload } = useFetch<ManageRow>(
    `/testing/manage/tests?status=${mode}`,
  )
  const [drawer, setDrawer] = useState<{ id: string | null } | null>(null)

  return (
    <div className="mb-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-border bg-surface p-1">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={clsx(
                'rounded-lg px-3 py-1 text-sm',
                mode === m.key ? 'bg-accent-soft font-medium text-accent' : 'text-muted',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        {can('testing.create') && (
          <button
            onClick={() => setDrawer({ id: null })}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus size={16} /> Створити тест
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {loading && <p className="px-4 py-6 text-center text-muted">Завантаження...</p>}
        {error && <p className="px-4 py-6 text-center text-danger">{error}</p>}
        {!loading && !error && data.length === 0 && (
          <p className="px-4 py-6 text-center text-muted">Поки нічого немає</p>
        )}
        {data.map((t) => (
          <button
            key={t.id}
            onClick={() => setDrawer({ id: t.id })}
            className="flex w-full items-center gap-3 border-t border-border px-4 py-3 text-left first:border-t-0 hover:bg-surface-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{t.title}</p>
              <p className="truncate text-sm text-muted">{t.description}</p>
            </div>
            {t.isRequired && (
              <span className="hidden shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent sm:inline">
                Обов'язковий
              </span>
            )}
            {t.category && (
              <span className="hidden shrink-0 rounded-md bg-surface-2 px-2 py-0.5 text-xs text-muted md:inline">
                {t.category.name}
              </span>
            )}
            <span className="hidden shrink-0 text-xs text-muted md:inline">
              Питань: {t._count.questions} / {t.questionCount}
            </span>
            <span className="hidden shrink-0 lg:inline">
              <Deadline iso={t.deadline} />
            </span>
          </button>
        ))}
      </div>

      {drawer && (
        <TestEditorDrawer
          testId={drawer.id}
          onClose={() => setDrawer(null)}
          onChanged={reload}
        />
      )}
    </div>
  )
}

function AvailableSection() {
  const { data, loading, error } = useFetch<AvailableTest>('/testing/tests')

  const scored = data.filter((t) => t.bestPercent !== null)
  const average = scored.length
    ? scored.reduce((sum, t) => sum + (t.bestPercent as number), 0) / scored.length
    : null
  const passed = data.filter((t) => t.myStatus === 'passed').length
  const failed = data.filter((t) => t.myStatus === 'failed').length

  return (
    <div>
      {data.length > 0 && (
        <div className="mb-6 rounded-2xl border border-border bg-surface p-4">
          <h3 className="mb-3 font-medium">Мої результати</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-surface-2 px-3 py-2">
              <p className="text-xs text-muted">Середній результат</p>
              <p className="text-xl font-semibold">
                {average === null ? '—' : `${Math.floor(average)}%`}
              </p>
            </div>
            <div className="rounded-xl bg-surface-2 px-3 py-2">
              <p className="text-xs text-muted">Пройдено</p>
              <p className="text-xl font-semibold">{passed}</p>
            </div>
            <div className="rounded-xl bg-surface-2 px-3 py-2">
              <p className="text-xs text-muted">Не пройдено</p>
              <p className="text-xl font-semibold">{failed}</p>
            </div>
          </div>
        </div>
      )}

      <h3 className="mb-3 text-lg font-semibold">Доступні тести</h3>
      {loading && <p className="text-muted">Завантаження...</p>}
      {error && <p className="text-danger">{error}</p>}
      {!loading && !error && data.length === 0 && (
        <p className="rounded-2xl border border-border bg-surface px-4 py-6 text-center text-muted">
          Вам поки не призначено жодного тесту
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.map((t) => {
          const action = t.inProgressAttemptId
            ? 'Продовжити'
            : t.myStatus === 'not_started' || t.myStatus === 'in_progress'
              ? 'Почати'
              : 'Деталі'
          return (
            <Link
              key={t.id}
              to={`/testing/${t.slug ?? t.id}`}
              className="flex flex-col rounded-2xl border border-border bg-surface p-5 hover:border-accent"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <TestStatusBadge status={t.myStatus} />
                {t.category && (
                  <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-muted">
                    {t.category.name}
                  </span>
                )}
                {t.isRequired && (
                  <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
                    Обов'язковий
                  </span>
                )}
              </div>
              <h4 className="text-base font-semibold">{t.title}</h4>
              {t.description && <p className="mt-1 text-sm text-muted">{t.description}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                <span className="inline-flex items-center gap-1">
                  <Clock size={14} /> {t.timeLimitMinutes} хв
                </span>
                <span>{t.questionCount} питань</span>
                <span>прохідний {t.passingScorePercent}%</span>
                <span>
                  {t.maxAttempts === 0
                    ? `спроб: ${t.attemptsUsed}`
                    : `спроб: ${t.attemptsUsed} з ${t.maxAttempts}`}
                </span>
                {t.bestPercent !== null && <span>найкращий: {Math.floor(t.bestPercent)}%</span>}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <Deadline iso={t.deadline} />
                <span className="ml-auto text-sm font-medium text-accent">{action} →</span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default function TestingPage() {
  const can = useCan()
  const canManage = can('testing.edit') || can('testing.create')
  const showAvailable = can('testing.start') || !canManage

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Тестування</h2>
          <p className="text-sm text-muted">Перевірка знань та результати</p>
        </div>
        {can('testing.view_analytics') && (
          <Link
            to="/testing/analytics"
            className="rounded-xl border border-border bg-surface px-4 py-2 text-sm hover:bg-surface-2"
          >
            Аналітика тестів
          </Link>
        )}
      </div>
      {canManage && <ManageSection />}
      {showAvailable && <AvailableSection />}
    </div>
  )
}