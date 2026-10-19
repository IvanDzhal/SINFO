import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, X } from 'lucide-react'
import clsx from 'clsx'
import { api } from '@/services/api'
import { useFetch } from '@/hooks/useFetch'
import UserResultsDrawer from '@/components/UserResultsDrawer'
import ExportButton from '@/components/ExportButton'
import TestStatusBadge, { type MyStatus } from '@/components/TestStatusBadge'

type Tab = 'tests' | 'stores' | 'regions' | 'users' | 'questions'

interface Counts {
  assigned: number
  passed: number
  failed: number
  inProgress: number
  notStarted: number
  overdue: number
  average: number | null
}
interface TestRow extends Counts {
  id: string
  title: string
  isRequired: boolean
  deadline: string | null
  avgTimeSec: number | null
}
interface StoreRow extends Counts {
  key: string
  storeId: string | null
  name: string
  city: string | null
  region: string | null
}
interface RegionRow extends Counts {
  key: string
  regionId: string | null
  name: string
}
interface UserRow extends Counts {
  id: string
  name: string
  login: string
  store: string | null
  region: string | null
  status: MyStatus | null
  best: number | null
}
interface QuestionRow {
  id: string
  number: number | null
  type: string
  text: string
  points: number
  archived: boolean
  answered: number
  correctPercent: number | null
  wrongPercent: number | null
  problem: boolean
}

const WARN_BELOW = 80

const pct = (v: number | null) => (v === null ? '—' : `${Math.floor(v)}%`)
const warn = (v: number | null) => v !== null && v < WARN_BELOW

function fmtTime(sec: number | null) {
  if (sec === null) return '—'
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
}

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  )
}

function Summary({ query }: { query: string }) {
  const [s, setS] = useState<Counts | null>(null)

  useEffect(() => {
    setS(null)
    api
      .get<Counts>(`/testing/analytics/summary${query}`)
      .then((r) => setS(r.data))
      .catch(() => {})
  }, [query])

  if (!s) return <p className="mb-6 text-muted">Завантаження...</p>
  const share = (n: number) => (s.assigned ? `${Math.round((n / s.assigned) * 100)}%` : '—')

  return (
    <div className="mb-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Card label="Призначено" value={String(s.assigned)} />
        <Card label="Пройшли" value={share(s.passed)} hint={`${s.passed} з ${s.assigned}`} />
        <Card label="Середній результат" value={pct(s.average)} />
        <Card label="Не пройшли" value={share(s.failed)} hint={`${s.failed} осіб`} />
        <Card label="Протерміновано" value={String(s.overdue)} />
      </div>
      <p className="mt-2 text-xs text-muted">
        В процесі: {s.inProgress} · Не розпочато: {s.notStarted}
      </p>
    </div>
  )
}

interface Col<T> {
  header: string
  cell: (r: T) => ReactNode
}

function Table<T>({
  rows,
  loading,
  error,
  columns,
  rowKey,
  onRow,
}: {
  rows: T[]
  loading: boolean
  error: string
  columns: Col<T>[]
  rowKey: (r: T) => string
  onRow?: (r: T) => void
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-surface-2 text-left text-muted">
          <tr>
            {columns.map((c) => (
              <th key={c.header} className="px-4 py-2.5 font-medium">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-6 text-center text-muted">
                Завантаження...
              </td>
            </tr>
          )}
          {error && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-6 text-center text-danger">
                {error}
              </td>
            </tr>
          )}
          {!loading && !error && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-6 text-center text-muted">
                Поки нічого немає
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr
              key={rowKey(r)}
              onClick={onRow ? () => onRow(r) : undefined}
              className={clsx('border-t border-border', onRow && 'cursor-pointer hover:bg-surface-2')}
            >
              {columns.map((c) => (
                <td key={c.header} className="px-4 py-2.5">
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Avg({ v }: { v: number | null }) {
  return (
    <span className={clsx(warn(v) && 'text-danger')}>
      {pct(v)}
      {warn(v) && ' ⚠️'}
    </span>
  )
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 text-sm text-accent">
      {label}
      <button onClick={onClear} aria-label="Прибрати фільтр">
        <X size={14} />
      </button>
    </span>
  )
}

export default function TestAnalyticsPage() {
  const [tab, setTab] = useState<Tab>('tests')
  const [test, setTest] = useState<{ id: string; title: string } | null>(null)
  const [store, setStore] = useState<{ id: string; name: string } | null>(null)
  const [region, setRegion] = useState<{ id: string; name: string } | null>(null)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    Object.entries(extra).forEach(([k, v]) => v && p.set(k, v))
    const s = p.toString()
    return s ? `?${s}` : ''
  }

  const tests = useFetch<TestRow>('/testing/analytics/tests')
  const stores = useFetch<StoreRow>(
    `/testing/analytics/stores${qs({ testId: test?.id, regionId: region?.id })}`,
  )
  const regions = useFetch<RegionRow>(`/testing/analytics/regions${qs({ testId: test?.id })}`)
  const users = useFetch<UserRow>(
    `/testing/analytics/users${qs({
      testId: test?.id,
      storeId: store?.id,
      regionId: region?.id,
      search: debounced,
    })}`,
  )
  const questions = useFetch<QuestionRow>(
    `/testing/analytics/questions${qs({ testId: test?.id ?? '_' })}`,
  )

  const tabs: { key: Tab; label: string }[] = [
    { key: 'tests', label: 'Тести' },
    { key: 'stores', label: 'Магазини' },
    { key: 'regions', label: 'Області' },
    { key: 'users', label: 'Працівники' },
    ...(test ? [{ key: 'questions' as Tab, label: 'Питання' }] : []),
  ]
  const activeTab = tab === 'questions' && !test ? 'tests' : tab

  return (
    <div>
      <Link
        to="/testing"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft size={16} /> Тестування
      </Link>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Аналітика тестів</h2>
        <ExportButton
          url="/testing/analytics/export"
          params={{ testId: test?.id, storeId: store?.id, regionId: region?.id, search: debounced }}
        />
      </div>
      <p className="mb-4 text-sm text-muted">
        Дані у межах вашого доступу. Лічильники рахуються за призначеннями (працівник × тест).
      </p>

      {(test || store || region) && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {test && <Chip label={`Тест: ${test.title}`} onClear={() => setTest(null)} />}
          {region && <Chip label={`Область: ${region.name}`} onClear={() => setRegion(null)} />}
          {store && <Chip label={`Магазин: ${store.name}`} onClear={() => setStore(null)} />}
        </div>
      )}

      <Summary query={qs({ testId: test?.id, storeId: store?.id, regionId: region?.id })} />

      <div className="mb-4 inline-flex flex-wrap rounded-xl border border-border bg-surface p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              'rounded-lg px-3 py-1 text-sm',
              activeTab === t.key ? 'bg-accent-soft font-medium text-accent' : 'text-muted',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'tests' && (
        <Table
          rows={tests.data}
          loading={tests.loading}
          error={tests.error}
          rowKey={(r) => r.id}
          onRow={(r) => {
            setTest({ id: r.id, title: r.title })
            setTab('stores')
          }}
          columns={[
            { header: 'Тест', cell: (r) => <span className="font-medium">{r.title}</span> },
            { header: 'Призначено', cell: (r) => r.assigned },
            { header: 'Пройшли', cell: (r) => r.passed },
            { header: 'Не пройшли', cell: (r) => r.failed },
            { header: 'Не розпочали', cell: (r) => r.notStarted + r.inProgress },
            { header: 'Протерміновано', cell: (r) => r.overdue },
            { header: 'Середній %', cell: (r) => <Avg v={r.average} /> },
            { header: 'Середній час', cell: (r) => fmtTime(r.avgTimeSec) },
          ]}
        />
      )}

      {activeTab === 'stores' && (
        <Table
          rows={stores.data}
          loading={stores.loading}
          error={stores.error}
          rowKey={(r) => r.key}
          onRow={(r) => {
            if (!r.storeId) return
            setStore({ id: r.storeId, name: r.name })
            setTab('users')
          }}
          columns={[
            {
              header: 'Магазин',
              cell: (r) => (
                <div>
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-muted">{[r.city, r.region].filter(Boolean).join(' · ')}</p>
                </div>
              ),
            },
            { header: 'Пройшли', cell: (r) => `${r.passed}/${r.assigned}` },
            { header: 'Не пройшли', cell: (r) => r.failed },
            { header: 'Протерміновано', cell: (r) => r.overdue },
            { header: 'Середній %', cell: (r) => <Avg v={r.average} /> },
          ]}
        />
      )}

      {activeTab === 'regions' && (
        <Table
          rows={regions.data}
          loading={regions.loading}
          error={regions.error}
          rowKey={(r) => r.key}
          onRow={(r) => {
            if (!r.regionId) return
            setRegion({ id: r.regionId, name: r.name })
            setTab('stores')
          }}
          columns={[
            { header: 'Область', cell: (r) => <span className="font-medium">{r.name}</span> },
            { header: 'Пройшли', cell: (r) => `${r.passed}/${r.assigned}` },
            { header: 'Не пройшли', cell: (r) => r.failed },
            { header: 'Протерміновано', cell: (r) => r.overdue },
            { header: 'Середній %', cell: (r) => <Avg v={r.average} /> },
          ]}
        />
      )}

      {activeTab === 'users' && (
        <div>
          <input
            className="mb-3 w-full max-w-sm rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            placeholder="Пошук за ім'ям або логіном"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Table
            rows={users.data}
            loading={users.loading}
            error={users.error}
            rowKey={(r) => r.id}
            onRow={(r) => setUserId(r.id)}
            columns={[
              {
                header: 'Працівник',
                cell: (r) => (
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-muted">{r.login}</p>
                  </div>
                ),
              },
              { header: 'Магазин', cell: (r) => r.store ?? '—' },
              {
                header: test ? 'Статус' : 'Тестів',
                cell: (r) => (test && r.status ? <TestStatusBadge status={r.status} /> : r.assigned),
              },
              { header: 'Пройдено', cell: (r) => r.passed },
              { header: 'Не пройдено', cell: (r) => r.failed },
              { header: 'Протерміновано', cell: (r) => r.overdue },
              {
                header: test ? 'Результат' : 'Середній %',
                cell: (r) => <Avg v={test ? r.best : r.average} />,
              },
            ]}
          />
        </div>
      )}

      {activeTab === 'questions' && (
        <Table
          rows={questions.data}
          loading={questions.loading}
          error={questions.error}
          rowKey={(r) => r.id}
          columns={[
            { header: '№', cell: (r) => (r.number === null ? '—' : r.number) },
            {
              header: 'Питання',
              cell: (r) => (
                <div>
                  <p className="max-w-md truncate">{r.text || '(без тексту)'}</p>
                  {r.archived && <p className="text-xs text-muted">архівне</p>}
                </div>
              ),
            },
            { header: 'Відповідей', cell: (r) => r.answered },
            { header: 'Правильних', cell: (r) => pct(r.correctPercent) },
            { header: 'Неправильних', cell: (r) => pct(r.wrongPercent) },
            {
              header: '',
              cell: (r) =>
                r.problem ? <span className="text-danger">⚠️ Питання проблемне</span> : null,
            },
          ]}
        />
      )}

      {userId && <UserResultsDrawer userId={userId} onClose={() => setUserId(null)} />}
    </div>
  )
}