import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import clsx from 'clsx'
import { api } from '@/services/api'
import {
  Card,
  Chip,
  LevelBadge,
  Table,
  Tabs,
  fmtMoney,
  fmtPct,
  levelText,
  qs,
  type Col,
  type Level,
} from './ui'
import {
  ChartCard,
  ColumnChart,
  HBarChart,
  LineChart,
  type Column,
  type Series,
} from './charts'

// ───────── типи відповіді API ─────────

interface MetricCell {
  plan: number | null
  fact: number | null
  dayFact: number | null
  percent: number | null
  remaining: number | null
  forecast: number | null
  forecastPercent: number | null
  deltaPercent: number | null
  needPerDay: number | null
  level: Level | null
  forecastLevel: Level | null
}
interface EffCell {
  value: number | null
  level: Level | null
}
interface Named {
  code: string
  name: string
  shortName: string
  unit?: string
}
interface Overview {
  month: string
  dataDate: string | null
  incomplete: boolean
  stores: { total: number; withData: number; stale: number; incomplete: number }
  metrics: (Named & MetricCell)[]
  efficiency: (Named & EffCell)[]
  alerts: { critical: number; warning: number }
}
interface StoreRow {
  id: string
  name: string
  code: string | null
  city: string | null
  region: string
  regionId: string
  dataDate: string | null
  daysPassed: number | null
  daysLeft: number | null
  stale: boolean
  hasSource: boolean
  alerts: number
  metrics: Record<string, MetricCell>
  efficiency: Record<string, EffCell>
  missing: string[]
}
interface StoresResponse {
  metrics: Named[]
  efficiency: Named[]
  stores: StoreRow[]
}
interface RegionRow {
  id: string
  name: string
  stores: number
  storesWithData: number
  metrics: Record<string, MetricCell>
  efficiency: Record<string, EffCell>
}
interface RegionsResponse {
  metrics: Named[]
  efficiency: Named[]
  regions: RegionRow[]
}
interface Alert {
  type: string
  severity: 'critical' | 'warning' | 'info'
  storeId: string
  store: string
  region: string
  message: string
}
interface RankRow {
  rank: number
  id: string
  name: string
  extra: string | null
  value: number | null
  level: Level | null
}
interface Ranking {
  criterion: { by: string; metric: string; metricName: string; label: string }
  rows: RankRow[]
  withoutData: { id: string; name: string }[]
}
interface StoreDetail {
  month: string
  store: StoreRow
  metrics: (Named & MetricCell)[]
  efficiency: (Named & EffCell)[]
  history: {
    date: string
    daysPassed: number | null
    metrics: Record<string, { fact: number | null; plan: number | null; dayFact: number | null; percent: number | null }>
    efficiency: Record<string, number | null>
  }[]
  alerts: Alert[]
}

type Tab = 'stores' | 'regions' | 'ranking' | 'alerts' | 'year'

// невеликий хук для одиночних запитів (useFetch працює лише з масивами)
function useGet<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(!!url)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!url) return
    let cancelled = false
    setLoading(true)
    setError('')
    api
      .get<T>(url)
      .then((r) => !cancelled && setData(r.data))
      .catch((e) => {
        if (cancelled) return
        setData(null)
        setError(e?.response?.data?.message ?? 'Не вдалося завантажити дані')
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [url])

  return { data, loading, error }
}

const MONTHS = [
  'січень', 'лютий', 'березень', 'квітень', 'травень', 'червень',
  'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень',
]
const monthLabel = (k: string) => {
  const [y, m] = k.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}
const fmtDate = (iso: string | null) => (iso ? iso.split('-').reverse().join('.') : '—')

// ───────── дрібні компоненти ─────────

function PctCell({ c }: { c: MetricCell | undefined }) {
  if (!c || c.percent === null) return <span className="text-muted">—</span>
  return (
    <div>
      <span className={levelText(c.level)}>{c.percent}%</span>
      {c.forecastPercent !== null && (
        <p className={clsx('text-xs', levelText(c.forecastLevel) || 'text-muted')}>
          прогноз {c.forecastPercent}%
        </p>
      )}
    </div>
  )
}

function EffValue({ c }: { c: EffCell | undefined }) {
  if (!c || c.value === null) return <span className="text-muted">—</span>
  return <span className={levelText(c.level)}>{c.value}%</span>
}

function MetricCard({ m }: { m: Named & MetricCell }) {
  const delta = m.deltaPercent
  return (
    <Card
      label={m.name}
      value={fmtPct(m.percent)}
      valueClass={levelText(m.level)}
      hint={m.plan === null ? 'Немає даних' : `${fmtMoney(m.fact)} з ${fmtMoney(m.plan)} грн`}
    >
      {m.plan !== null && (
        <div className="mt-1 space-y-0.5 text-xs text-muted">
          <p>Залишилось: {fmtMoney(m.remaining)} грн</p>
          <p className={levelText(m.forecastLevel)}>Прогноз: {fmtPct(m.forecastPercent)}</p>
          {delta !== null && <p>За день: {delta > 0 ? '+' : ''}{delta} п.п.</p>}
        </div>
      )}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className={clsx(
            'h-full rounded-full',
            m.level === 'critical' || m.level === 'bad'
              ? 'bg-danger'
              : m.level === 'warn'
                ? 'bg-accent'
                : 'bg-success',
          )}
          style={{ width: `${Math.min(100, m.percent ?? 0)}%` }}
        />
      </div>
    </Card>
  )
}

function OverviewCards({
  o,
  loading,
  error,
}: {
  o: Overview | null
  loading: boolean
  error: string
}) {
  if (loading) return <p className="mb-6 text-muted">Завантаження...</p>
  if (error || !o) return <p className="mb-6 text-danger">{error || 'Немає даних'}</p>

  return (
    <div className="mb-6">
      {o.incomplete && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-border bg-accent-soft px-3 py-2 text-sm text-accent">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            Дані можуть бути неповними: з даними {o.stores.withData} з {o.stores.total} магазинів
            {o.stores.stale > 0 && `, застарілих: ${o.stores.stale}`}
            {o.stores.incomplete > 0 && `, з неповними показниками: ${o.stores.incomplete}`}.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {o.metrics.map((m) => (
          <MetricCard key={m.code} m={m} />
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        {o.efficiency.map((e) => (
          <Card
            key={e.code}
            label={e.name}
            value={fmtPct(e.value)}
            valueClass={levelText(e.level)}
            hint={e.level ? undefined : 'без порогів'}
          >
            <div className="mt-1">
              <LevelBadge level={e.level} />
            </div>
          </Card>
        ))}
        <Card
          label="Сигнали"
          value={String(o.alerts.critical + o.alerts.warning)}
          hint={`критичних: ${o.alerts.critical}`}
        />
      </div>
      <p className="mt-2 text-xs text-muted">
        Дані станом на {fmtDate(o.dataDate)}. Прогноз — за поточним темпом продажів.
      </p>
    </div>
  )
}

const ddmm = (d: string) => d.slice(5).split('-').reverse().join('.')

// Діаграми головної сторінки: три, усі по окремих магазинах (без зведення по мережі)
function SelectBox({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="text-xs text-muted">
      {label}{' '}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="ml-1 rounded-lg border border-border bg-surface px-2 py-1 text-sm text-ink"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function ChartsPanel({
  stores,
  query,
  onStore,
}: {
  stores: StoresResponse | null
  query: string
  onStore: (id: string) => void
}) {
  const [planCode, setPlanCode] = useState('TO')
  const [effCode, setEffCode] = useState('')
  const [storeId, setStoreId] = useState('')

  const list = stores?.stores ?? []
  const effDefs = stores?.efficiency ?? []
  const selectedEff = effCode || effDefs[0]?.code || ''

  // обраний для динаміки магазин: перший із даними, поки користувач не обрав сам
  const withData = list.filter((s) => s.dataDate)
  const activeStore = storeId || withData[0]?.id || ''
  const detail = useGet<StoreDetail>(activeStore ? `/analytics/sales/stores/${activeStore}${query}` : null)

  if (!stores) return null

  const planBars = [...list]
    .filter((s) => s.metrics[planCode]?.percent !== null && s.metrics[planCode]?.percent !== undefined)
    .sort((a, b) => (b.metrics[planCode].percent ?? 0) - (a.metrics[planCode].percent ?? 0))
  const effBars = [...list]
    .filter((s) => s.efficiency[selectedEff]?.value !== null && s.efficiency[selectedEff]?.value !== undefined)
    .sort((a, b) => (b.efficiency[selectedEff].value ?? 0) - (a.efficiency[selectedEff].value ?? 0))

  const hist = detail.data?.history ?? []
  const planSeries: Series[] = (detail.data?.metrics ?? []).map((m) => ({
    name: m.shortName,
    points: hist.map((h) => h.metrics[m.code]?.percent ?? null),
  }))

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartCard
        title="Виконання плану по магазинах"
        hint="Риска — прогноз на кінець місяця, лінія — 100% плану. Натисніть на магазин."
      >
        <div className="mb-3">
          <SelectBox
            label="Показник"
            value={planCode}
            onChange={setPlanCode}
            options={stores.metrics.map((m) => ({ value: m.code, label: m.name }))}
          />
        </div>
        <HBarChart
          items={planBars.map((s) => ({
            label: s.code ?? s.name,
            value: s.metrics[planCode].percent,
            level: s.metrics[planCode].level,
            marker: s.metrics[planCode].forecastPercent,
          }))}
          max={Math.max(120, ...planBars.map((s) => s.metrics[planCode].forecastPercent ?? 0))}
          refLine={100}
          onClick={(i) => onStore(planBars[i].id)}
        />
      </ChartCard>

      <ChartCard title="Ефективність по магазинах" hint="Колір — за порогами ефективності. Натисніть на магазин.">
        <div className="mb-3">
          <SelectBox
            label="Показник"
            value={selectedEff}
            onChange={setEffCode}
            options={effDefs.map((e) => ({ value: e.code, label: e.name }))}
          />
        </div>
        <HBarChart
          items={effBars.map((s) => ({
            label: s.code ?? s.name,
            value: s.efficiency[selectedEff].value,
            level: s.efficiency[selectedEff].level,
          }))}
          max={Math.max(20, ...effBars.map((s) => s.efficiency[selectedEff].value ?? 0))}
          onClick={(i) => onStore(effBars[i].id)}
        />
      </ChartCard>

      <ChartCard
        title="Динаміка магазину по днях"
        hint={hist.length < 2 ? 'Лінії з’являться, коли накопичиться кілька днів даних' : 'Виконання плану, % за день'}
        className="lg:col-span-2"
      >
        <div className="mb-3">
          <SelectBox
            label="Магазин"
            value={activeStore}
            onChange={setStoreId}
            options={withData.map((s) => ({ value: s.id, label: s.name }))}
          />
        </div>
        {detail.loading ? (
          <p className="py-6 text-center text-sm text-muted">Завантаження...</p>
        ) : (
          <LineChart labels={hist.map((h) => ddmm(h.date))} series={planSeries} />
        )}
      </ChartCard>
    </div>
  )
}

interface YearStoreMonth {
  lastDate: string
  partial: boolean
  metrics: Record<string, { plan: number | null; fact: number | null; percent: number | null; level: Level | null }>
  efficiency: Record<string, EffCell>
}
interface YearStore {
  id: string
  name: string
  code: string | null
  city: string | null
  region: string
  months: Record<string, YearStoreMonth>
}
interface YearResponse {
  year: number
  metrics: Named[]
  efficiency: Named[]
  stores: YearStore[]
}

const SHORT_MONTHS = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру']

// Фон комірки за рівнем (таблиця «магазин × місяць»)
const CELL_BG: Record<Level, string> = {
  critical: 'bg-danger/25',
  bad: 'bg-danger/10',
  warn: 'bg-accent-soft',
  good: 'bg-success-soft',
  excellent: 'bg-success-soft',
}

function YearView({
  regionId,
  years,
  onStore,
}: {
  regionId?: string
  years: string[]
  onStore: (id: string) => void
}) {
  const [year, setYear] = useState(years[0] ?? String(new Date().getFullYear()))
  const [code, setCode] = useState('TO')
  const [storeId, setStoreId] = useState('')
  const { data, loading, error } = useGet<YearResponse>(`/analytics/sales/year${qs({ year, regionId })}`)

  if (loading) return <p className="text-muted">Завантаження...</p>
  if (error || !data) return <p className="text-danger">{error || 'Немає даних'}</p>

  const keys = SHORT_MONTHS.map((_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
  const isEff = data.efficiency.some((e) => e.code === code)
  const pick = (m: YearStoreMonth | undefined): { v: number | null; level: Level | null } => {
    if (!m) return { v: null, level: null }
    if (isEff) {
      const c = m.efficiency[code]
      return { v: c?.value ?? null, level: c?.level ?? null }
    }
    const c = m.metrics[code]
    return { v: c?.percent ?? null, level: c?.level ?? null }
  }

  const storeList = data.stores ?? []
  const withAny = storeList.filter((s) => Object.keys(s.months).length > 0)
  const active = storeList.find((s) => s.id === storeId) ?? withAny[0]

  const columns: Column[] = active
    ? keys.map((k, i) => {
        const m = active.months[k]
        const p = pick(m)
        return {
          label: SHORT_MONTHS[i],
          value: p.v,
          level: p.level,
          faded: m?.partial,
          note: m?.partial ? 'місяць не закритий' : undefined,
        }
      })
    : []

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <SelectBox
          label="Рік"
          value={year}
          onChange={setYear}
          options={(years.length ? years : [year]).map((y) => ({ value: y, label: y }))}
        />
        <SelectBox
          label="Показник"
          value={code}
          onChange={setCode}
          options={[
            ...data.metrics.map((m) => ({ value: m.code, label: m.name })),
            ...data.efficiency.map((e) => ({ value: e.code, label: e.name })),
          ]}
        />
      </div>

      <div className="mb-3 flex items-start gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs text-muted">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <span>
          Дані накопичуються з моменту підключення синхронізації: таблиці магазинів щомісяця очищаються,
          тому попередні місяці відновити неможливо. Значення з позначкою «~» — місяць ще не закритий
          (станом на останню синхронізацію).
        </span>
      </div>

      <div className="mb-6 overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-surface-2 text-left text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Магазин</th>
              {SHORT_MONTHS.map((m) => (
                <th key={m} className="px-2 py-2.5 text-center font-medium">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {storeList.length === 0 && (
              <tr>
                <td colSpan={13} className="px-4 py-6 text-center text-muted">
                  Немає магазинів у межах доступу
                </td>
              </tr>
            )}
            {storeList.map((s) => (
              <tr
                key={s.id}
                className={clsx(
                  'cursor-pointer border-t border-border hover:bg-surface-2',
                  active?.id === s.id && 'bg-accent-soft/40',
                )}
                onClick={() => setStoreId(s.id)}
              >
                <td className="whitespace-nowrap px-4 py-2">
                  <p className="font-medium">{s.code ?? s.name}</p>
                  <p className="text-xs text-muted">{s.name}</p>
                </td>
                {keys.map((k) => {
                  const m = s.months[k]
                  const p = pick(m)
                  return (
                    <td
                      key={k}
                      title={m ? `станом на ${fmtDate(m.lastDate)}${m.partial ? ' · не закритий' : ''}` : 'немає даних'}
                      className={clsx(
                        'px-2 py-2 text-center tabular-nums',
                        p.level ? CELL_BG[p.level] : '',
                        levelText(p.level),
                      )}
                    >
                      {p.v === null ? '—' : `${m?.partial ? '~' : ''}${p.v}%`}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ChartCard
        title={active ? `${active.name} — по місяцях, ${year}` : 'По місяцях'}
        hint="Оберіть магазин у таблиці вище або тут"
      >
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <SelectBox
            label="Магазин"
            value={active?.id ?? ''}
            onChange={setStoreId}
            options={storeList.map((s) => ({ value: s.id, label: s.name }))}
          />
          {active && (
            <button className="text-sm text-accent hover:underline" onClick={() => onStore(active.id)}>
              Відкрити магазин
            </button>
          )}
        </div>
        <ColumnChart
          columns={columns}
          max={isEff ? Math.max(20, ...columns.map((c) => c.value ?? 0)) : Math.max(120, ...columns.map((c) => c.value ?? 0))}
        />
      </ChartCard>
    </div>
  )
}

// Динаміка виконання плану по днях місяця (SVG, без залежностей)
const LINE_COLORS = ['#ff6b00', '#2563eb', '#16a34a', '#a855f7', '#0891b2']

function HistoryChart({ detail, codes }: { detail: StoreDetail; codes: Named[] }) {
  const pts = detail.history
  if (pts.length < 2) {
    return <p className="text-sm text-muted">Для графіка потрібно щонайменше два дні даних.</p>
  }
  const W = 640
  const H = 220
  const pad = { l: 36, r: 12, t: 12, b: 24 }
  const max = Math.max(100, ...pts.flatMap((p) => codes.map((c) => p.metrics[c.code]?.percent ?? 0)))
  const x = (i: number) => pad.l + (i / (pts.length - 1)) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b)

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Динаміка виконання плану">
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={pad.l} x2={W - pad.r} y1={y(g)} y2={y(g)} stroke="currentColor" opacity={0.12} />
            <text x={pad.l - 6} y={y(g) + 4} textAnchor="end" fontSize="10" fill="currentColor" opacity={0.6}>
              {g}%
            </text>
          </g>
        ))}
        {codes.map((c, ci) => {
          const d = pts
            .map((p, i) => ({ i, v: p.metrics[c.code]?.percent }))
            .filter((p): p is { i: number; v: number } => p.v !== null && p.v !== undefined)
          if (d.length < 2) return null
          return (
            <polyline
              key={c.code}
              fill="none"
              stroke={LINE_COLORS[ci % LINE_COLORS.length]}
              strokeWidth={2}
              points={d.map((p) => `${x(p.i)},${y(p.v)}`).join(' ')}
            />
          )
        })}
        {[0, Math.floor((pts.length - 1) / 2), pts.length - 1].map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="currentColor" opacity={0.6}>
            {pts[i].date.slice(5).split('-').reverse().join('.')}
          </text>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {codes.map((c, ci) => (
          <span key={c.code} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: LINE_COLORS[ci % LINE_COLORS.length] }}
            />
            {c.shortName}
          </span>
        ))}
      </div>
    </div>
  )
}

function AlertsList({ alerts, onStore }: { alerts: Alert[]; onStore?: (id: string, name: string) => void }) {
  if (alerts.length === 0) return <p className="text-sm text-muted">Сигналів немає.</p>
  const dot = { critical: 'bg-danger', warning: 'bg-accent', info: 'bg-muted' } as const
  return (
    <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
      {alerts.map((a, i) => (
        <li key={i} className="flex items-start gap-3 px-4 py-2.5 text-sm">
          <span className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', dot[a.severity])} />
          <div className="min-w-0">
            {onStore ? (
              <button
                className="font-medium text-accent hover:underline"
                onClick={() => onStore(a.storeId, a.store)}
              >
                {a.store}
              </button>
            ) : (
              <span className="font-medium">{a.store}</span>
            )}
            <span className="text-muted"> · {a.region}</span>
            <p>{a.message}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

function StoreDetailView({
  id,
  query,
  onBack,
}: {
  id: string
  query: string
  onBack: () => void
}) {
  const { data, loading, error } = useGet<StoreDetail>(`/analytics/sales/stores/${id}${query}`)

  return (
    <div>
      <button onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} /> До списку
      </button>
      {loading && <p className="text-muted">Завантаження...</p>}
      {error && <p className="text-danger">{error}</p>}
      {data && (
        <>
          <h3 className="text-lg font-semibold">
            {data.store.name}
            {data.store.code && <span className="ml-2 text-sm text-muted">{data.store.code}</span>}
          </h3>
          <p className="mb-4 text-sm text-muted">
            {[data.store.city, data.store.region].filter(Boolean).join(' · ')} · дані станом на{' '}
            {fmtDate(data.store.dataDate)}
            {data.store.daysPassed !== null && data.store.daysLeft !== null
              ? ` · день ${data.store.daysPassed} з ${data.store.daysPassed + data.store.daysLeft}`
              : ''}
          </p>

          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {data.metrics.map((m) => (
              <MetricCard key={m.code} m={m} />
            ))}
          </div>

          <h4 className="mb-2 font-medium">План / факт</h4>
          <div className="mb-6">
            <Table
              rows={data.metrics}
              loading={false}
              error=""
              rowKey={(m) => m.code}
              columns={[
                { header: 'Показник', cell: (m) => <span className="font-medium">{m.name}</span> },
                { header: 'План', cell: (m) => fmtMoney(m.plan) },
                { header: 'Факт', cell: (m) => fmtMoney(m.fact) },
                { header: '%', cell: (m) => <span className={levelText(m.level)}>{fmtPct(m.percent)}</span> },
                { header: 'Залишилось', cell: (m) => fmtMoney(m.remaining) },
                { header: 'За день', cell: (m) => fmtMoney(m.dayFact) },
                { header: 'Потрібно / день', cell: (m) => fmtMoney(m.needPerDay) },
                {
                  header: 'Прогноз',
                  cell: (m) => (
                    <span className={levelText(m.forecastLevel)}>{fmtPct(m.forecastPercent)}</span>
                  ),
                },
              ]}
            />
          </div>

          <h4 className="mb-2 font-medium">Ефективність</h4>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
            {data.efficiency.map((e) => (
              <Card key={e.code} label={e.name} value={fmtPct(e.value)} valueClass={levelText(e.level)}>
                <div className="mt-1">
                  <LevelBadge level={e.level} />
                </div>
              </Card>
            ))}
          </div>

          <h4 className="mb-2 font-medium">Динаміка виконання плану</h4>
          <div className="mb-6 rounded-2xl border border-border bg-surface p-4">
            <HistoryChart detail={data} codes={data.metrics} />
          </div>

          <h4 className="mb-2 font-medium">Сигнали</h4>
          <AlertsList alerts={data.alerts} />
        </>
      )}
    </div>
  )
}

// ───────── основний розділ ─────────

export default function SalesSection() {
  const [tab, setTab] = useState<Tab>('stores')
  const [month, setMonth] = useState<string>('')
  const [region, setRegion] = useState<{ id: string; name: string } | null>(null)
  const [storeId, setStoreId] = useState<string | null>(null)

  const [by, setBy] = useState<'completion' | 'forecast' | 'efficiency'>('completion')
  const [metric, setMetric] = useState('TO')
  const [level, setLevel] = useState<'stores' | 'regions'>('stores')

  const periods = useGet<string[]>('/analytics/sales/periods')
  useEffect(() => {
    if (periods.data?.length && !month) setMonth(periods.data.find((m) => m) ?? '')
  }, [periods.data, month])

  const base = qs({ month, regionId: region?.id })
  const overview = useGet<Overview>(`/analytics/sales/overview${base}`)
  const stores = useGet<StoresResponse>(`/analytics/sales/stores${base}`)
  const regions = useGet<RegionsResponse>(`/analytics/sales/regions${qs({ month })}`)
  const alerts = useGet<{ alerts: Alert[] }>(tab === 'alerts' ? `/analytics/sales/alerts${base}` : null)
  const ranking = useGet<Ranking>(
    tab === 'ranking'
      ? `/analytics/sales/rankings${qs({ month, regionId: region?.id, by, metric, level })}`
      : null,
  )

  if (storeId) {
    return <StoreDetailView id={storeId} query={qs({ month })} onBack={() => setStoreId(null)} />
  }

  const metricDefs = stores.data?.metrics ?? []
  const effDefs = stores.data?.efficiency ?? []

  const openStore = (id: string) => setStoreId(id)

  const metricCols = (get: (code: string, r: any) => MetricCell | undefined): Col<any>[] =>
    metricDefs.map((m) => ({ header: m.shortName, cell: (r) => <PctCell c={get(m.code, r)} /> }))
  const effCols = (get: (code: string, r: any) => EffCell | undefined): Col<any>[] =>
    effDefs.map((e) => ({ header: e.shortName, cell: (r) => <EffValue c={get(e.code, r)} /> }))

  const tabs: { key: Tab; label: string }[] = [
    { key: 'stores', label: 'Магазини' },
    { key: 'regions', label: 'Області' },
    { key: 'ranking', label: 'Рейтинг' },
    { key: 'alerts', label: 'Сигнали' },
    { key: 'year', label: 'Рік' },
  ]

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-muted">
          Період{' '}
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="ml-1 rounded-xl border border-border bg-surface px-3 py-1.5 text-sm text-ink"
          >
            {(periods.data ?? []).map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </label>
        {region && <Chip label={`Область: ${region.name}`} onClear={() => setRegion(null)} />}
      </div>

      <OverviewCards o={overview.data} loading={overview.loading} error={overview.error} />
      <ChartsPanel stores={stores.data} query={qs({ month })} onStore={openStore} />

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'stores' && (
        <Table<StoreRow>
          rows={stores.data?.stores ?? []}
          loading={stores.loading}
          error={stores.error}
          rowKey={(r) => r.id}
          onRow={(r) => openStore(r.id)}
          columns={[
            {
              header: 'Магазин',
              cell: (r) => (
                <div>
                  <p className="font-medium">
                    {r.name}
                    {r.code && <span className="ml-2 text-xs text-muted">{r.code}</span>}
                  </p>
                  <p className="text-xs text-muted">{[r.city, r.region].filter(Boolean).join(' · ')}</p>
                </div>
              ),
            },
            ...(metricCols((code, r: StoreRow) => r.metrics[code]) as Col<StoreRow>[]),
            ...(effCols((code, r: StoreRow) => r.efficiency[code]) as Col<StoreRow>[]),
            {
              header: 'Дані',
              cell: (r) =>
                !r.hasSource ? (
                  <span className="text-xs text-muted">немає таблиці</span>
                ) : !r.dataDate ? (
                  <span className="text-xs text-danger">немає даних</span>
                ) : (
                  <span className={clsx('text-xs', r.stale || r.missing.length ? 'text-accent' : 'text-muted')}>
                    {fmtDate(r.dataDate)}
                    {r.stale && ' · застарілі'}
                    {!r.stale && r.missing.length > 0 && ' · неповні'}
                  </span>
                ),
            },
            {
              header: '⚠',
              cell: (r) => (r.alerts > 0 ? <span className="text-accent">{r.alerts}</span> : ''),
            },
          ]}
        />
      )}

      {tab === 'regions' && (
        <Table<RegionRow>
          rows={regions.data?.regions ?? []}
          loading={regions.loading}
          error={regions.error}
          rowKey={(r) => r.id}
          onRow={(r) => {
            setRegion({ id: r.id, name: r.name })
            setTab('stores')
          }}
          columns={[
            {
              header: 'Область',
              cell: (r) => (
                <div>
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-muted">
                    магазинів: {r.storesWithData} з {r.stores} з даними
                  </p>
                </div>
              ),
            },
            ...(metricCols((code, r: RegionRow) => r.metrics[code]) as Col<RegionRow>[]),
            ...(effCols((code, r: RegionRow) => r.efficiency[code]) as Col<RegionRow>[]),
          ]}
        />
      )}

      {tab === 'ranking' && (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <label className="text-muted">
              Критерій{' '}
              <select
                value={by}
                onChange={(e) => {
                  const v = e.target.value as typeof by
                  setBy(v)
                  setMetric(v === 'efficiency' ? (effDefs[0]?.code ?? 'SERVICES_EFFICIENCY') : 'TO')
                }}
                className="ml-1 rounded-xl border border-border bg-surface px-3 py-1.5 text-ink"
              >
                <option value="completion">Виконання плану</option>
                <option value="forecast">Прогноз</option>
                <option value="efficiency">Ефективність</option>
              </select>
            </label>
            <label className="text-muted">
              Показник{' '}
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
                className="ml-1 rounded-xl border border-border bg-surface px-3 py-1.5 text-ink"
              >
                {(by === 'efficiency' ? effDefs : metricDefs).map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-muted">
              Рівень{' '}
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as typeof level)}
                className="ml-1 rounded-xl border border-border bg-surface px-3 py-1.5 text-ink"
              >
                <option value="stores">Магазини</option>
                <option value="regions">Області</option>
              </select>
            </label>
          </div>
          {ranking.data && (
            <p className="mb-2 text-xs text-muted">
              Критерій: {ranking.data.criterion.label} · {ranking.data.criterion.metricName}
            </p>
          )}
          <Table<RankRow>
            rows={ranking.data?.rows ?? []}
            loading={ranking.loading}
            error={ranking.error}
            rowKey={(r) => r.id}
            onRow={level === 'stores' ? (r) => openStore(r.id) : undefined}
            columns={[
              { header: '#', cell: (r) => r.rank },
              {
                header: level === 'stores' ? 'Магазин' : 'Область',
                cell: (r) => (
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-muted">{r.extra}</p>
                  </div>
                ),
              },
              { header: 'Значення', cell: (r) => <span className={levelText(r.level)}>{fmtPct(r.value)}</span> },
              { header: 'Рівень', cell: (r) => <LevelBadge level={r.level} /> },
            ]}
          />
          {ranking.data && ranking.data.withoutData.length > 0 && (
            <p className="mt-2 text-xs text-muted">
              Без даних для цього критерію: {ranking.data.withoutData.map((w) => w.name).join(', ')}
            </p>
          )}
        </div>
      )}

      {tab === 'year' && (
        <YearView
          regionId={region?.id}
          years={[...new Set((periods.data ?? []).map((m) => m.slice(0, 4)))]}
          onStore={openStore}
        />
      )}

      {tab === 'alerts' && (
        <>
          {alerts.loading && <p className="text-muted">Завантаження...</p>}
          {alerts.error && <p className="text-danger">{alerts.error}</p>}
          {alerts.data && <AlertsList alerts={alerts.data.alerts} onStore={(id) => openStore(id)} />}
        </>
      )}
    </div>
  )
}
