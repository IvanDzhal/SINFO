import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import clsx from 'clsx'

// Кольорова градація метрик: порогові значення задає backend (SalesMetricDef.thresholds)
export type Level = 'critical' | 'bad' | 'warn' | 'good' | 'excellent'

const LEVEL_STYLE: Record<Level, { label: string; text: string; pill: string }> = {
  critical: { label: 'Критично', text: 'text-danger font-semibold', pill: 'bg-danger/15 text-danger' },
  bad: { label: 'Низько', text: 'text-danger', pill: 'bg-danger/10 text-danger' },
  warn: { label: 'Увага', text: 'text-accent', pill: 'bg-accent-soft text-accent' },
  good: { label: 'Норма', text: 'text-success', pill: 'bg-success-soft text-success' },
  excellent: { label: 'Відмінно', text: 'text-success font-semibold', pill: 'bg-success-soft text-success' },
}

export const levelText = (l: Level | null | undefined) => (l ? LEVEL_STYLE[l].text : '')
export const levelLabel = (l: Level | null | undefined) => (l ? LEVEL_STYLE[l].label : '')

export function LevelBadge({ level }: { level: Level | null | undefined }) {
  if (!level) return null
  const s = LEVEL_STYLE[level]
  return <span className={clsx('rounded-full px-2 py-0.5 text-xs font-medium', s.pill)}>{s.label}</span>
}

export const fmtPct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v}%`)

export const fmtMoney = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : Math.round(v).toLocaleString('uk-UA')

export function Card({
  label,
  value,
  hint,
  valueClass,
  children,
}: {
  label: string
  value: string
  hint?: string
  valueClass?: string
  children?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={clsx('text-2xl font-semibold', valueClass)}>{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      {children}
    </div>
  )
}

export interface Col<T> {
  header: string
  cell: (r: T) => ReactNode
}

export function Table<T>({
  rows,
  loading,
  error,
  columns,
  rowKey,
  onRow,
  empty = 'Поки нічого немає',
}: {
  rows: T[]
  loading: boolean
  error: string
  columns: Col<T>[]
  rowKey: (r: T) => string
  onRow?: (r: T) => void
  empty?: string
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
                {empty}
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

export function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 text-sm text-accent">
      {label}
      <button onClick={onClear} aria-label="Прибрати фільтр">
        <X size={14} />
      </button>
    </span>
  )
}

export function Tabs<K extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: K; label: string }[]
  value: K
  onChange: (k: K) => void
}) {
  return (
    <div className="mb-4 inline-flex flex-wrap rounded-xl border border-border bg-surface p-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={clsx(
            'rounded-lg px-3 py-1 text-sm',
            value === t.key ? 'bg-accent-soft font-medium text-accent' : 'text-muted',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export const qs = (extra: Record<string, string | undefined | null>) => {
  const p = new URLSearchParams()
  Object.entries(extra).forEach(([k, v]) => v && p.set(k, v))
  const s = p.toString()
  return s ? `?${s}` : ''
}
