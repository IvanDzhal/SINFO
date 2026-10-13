import clsx from 'clsx'
import type { ReactNode } from 'react'
import type { Level } from './ui'

// Прості SVG-діаграми без залежностей. Кольори беруться з тем (світла/темна) через CSS-змінні.

const LEVEL_FILL: Record<Level, string> = {
  critical: 'var(--danger)',
  bad: 'color-mix(in srgb, var(--danger) 60%, transparent)',
  warn: 'var(--accent)',
  good: 'var(--success)',
  excellent: 'var(--success)',
}
export const levelFill = (l: Level | null | undefined) => (l ? LEVEL_FILL[l] : 'var(--muted)')

export const SERIES_COLORS = ['#ff6b00', '#2563eb', '#16a34a', '#a855f7', '#0891b2', '#db2777']

export function ChartCard({
  title,
  hint,
  children,
  className,
}: {
  title: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={clsx('rounded-2xl border border-border bg-surface p-4', className)}>
      <h4 className="font-medium">{title}</h4>
      {hint && <p className="mb-3 text-xs text-muted">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </div>
  )
}

export function Empty({ text = 'Недостатньо даних для діаграми' }: { text?: string }) {
  return <p className="py-6 text-center text-sm text-muted">{text}</p>
}

// ───────── горизонтальні смуги ─────────

export interface BarItem {
  label: string
  value: number | null
  level?: Level | null
  marker?: number | null // напр. прогноз
  note?: string
}

export function HBarChart({
  items,
  max,
  unit = '%',
  refLine,
  onClick,
}: {
  items: BarItem[]
  max?: number
  unit?: string
  refLine?: number
  onClick?: (i: number) => void
}) {
  const known = items.filter((i) => i.value !== null)
  if (known.length === 0) return <Empty />
  const top = max ?? Math.max(100, ...items.flatMap((i) => [i.value ?? 0, i.marker ?? 0]))

  return (
    <div className="space-y-2">
      {items.map((it, idx) => {
        const w = it.value === null ? 0 : Math.max(0, Math.min(100, (it.value / top) * 100))
        const m = it.marker === null || it.marker === undefined ? null : Math.min(100, (it.marker / top) * 100)
        return (
          <div
            key={`${it.label}-${idx}`}
            className={clsx('grid grid-cols-[110px_1fr_56px] items-center gap-2 text-sm', onClick && 'cursor-pointer')}
            onClick={onClick ? () => onClick(idx) : undefined}
          >
            <span className="truncate text-muted" title={it.label}>
              {it.label}
            </span>
            <div className="relative h-4 rounded bg-surface-2">
              <div className="h-full rounded" style={{ width: `${w}%`, background: levelFill(it.level) }} />
              {m !== null && (
                <span
                  className="absolute top-[-2px] h-5 w-0.5 bg-ink"
                  style={{ left: `calc(${m}% - 1px)` }}
                  title={`Прогноз ${it.marker}${unit}`}
                />
              )}
              {refLine !== undefined && (
                <span
                  className="absolute top-0 h-4 w-px bg-ink/40"
                  style={{ left: `${Math.min(100, (refLine / top) * 100)}%` }}
                />
              )}
            </div>
            <span className="text-right tabular-nums">
              {it.value === null ? '—' : `${it.value}${unit}`}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ───────── лінії ─────────

export interface Series {
  name: string
  color?: string
  points: (number | null)[]
}

export function LineChart({
  labels,
  series,
  height = 220,
  yMax,
  unit = '%',
}: {
  labels: string[]
  series: Series[]
  height?: number
  yMax?: number
  unit?: string
}) {
  const hasData = series.some((s) => s.points.some((p) => p !== null))
  if (!hasData || labels.length === 0) return <Empty />

  const W = 640
  const H = height
  const pad = { l: 40, r: 12, t: 12, b: 26 }
  const all = series.flatMap((s) => s.points.filter((p): p is number => p !== null))
  const max = yMax ?? Math.max(100, Math.ceil(Math.max(...all) / 10) * 10)
  const n = labels.length
  const x = (i: number) => (n === 1 ? (pad.l + W - pad.r) / 2 : pad.l + (i / (n - 1)) * (W - pad.l - pad.r))
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t))
  const labelAt = n <= 4 ? labels.map((_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1]

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
        {ticks.map((g) => (
          <g key={g}>
            <line x1={pad.l} x2={W - pad.r} y1={y(g)} y2={y(g)} stroke="currentColor" opacity={0.12} />
            <text x={pad.l - 6} y={y(g) + 4} textAnchor="end" fontSize="10" fill="currentColor" opacity={0.6}>
              {g}
              {unit}
            </text>
          </g>
        ))}
        {series.map((s, si) => {
          const color = s.color ?? SERIES_COLORS[si % SERIES_COLORS.length]
          const pts = s.points
            .map((v, i) => (v === null ? null : { i, v }))
            .filter((p): p is { i: number; v: number } => p !== null)
          return (
            <g key={s.name}>
              {pts.length > 1 && (
                <polyline
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  points={pts.map((p) => `${x(p.i)},${y(p.v)}`).join(' ')}
                />
              )}
              {pts.map((p) => (
                <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={3} fill={color}>
                  <title>
                    {s.name}: {p.v}
                    {unit} · {labels[p.i]}
                  </title>
                </circle>
              ))}
            </g>
          )
        })}
        {labelAt.map((i) => (
          <text key={i} x={x(i)} y={H - 7} textAnchor="middle" fontSize="10" fill="currentColor" opacity={0.6}>
            {labels[i]}
          </text>
        ))}
      </svg>
      <Legend items={series.map((s, i) => ({ name: s.name, color: s.color ?? SERIES_COLORS[i % SERIES_COLORS.length] }))} />
    </div>
  )
}

export function Legend({ items }: { items: { name: string; color: string }[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((it) => (
        <span key={it.name} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: it.color }} />
          {it.name}
        </span>
      ))}
    </div>
  )
}

// ───────── стовпці по категоріях (місяці) ─────────

export interface Column {
  label: string
  value: number | null
  level?: Level | null
  faded?: boolean // незакритий місяць
  note?: string
}

export function ColumnChart({
  columns,
  height = 200,
  max,
  unit = '%',
}: {
  columns: Column[]
  height?: number
  max?: number
  unit?: string
}) {
  if (!columns.some((c) => c.value !== null)) return <Empty text="За цей рік ще немає даних" />
  const W = 640
  const H = height
  const pad = { l: 40, r: 8, t: 14, b: 26 }
  const top = max ?? Math.max(100, Math.ceil(Math.max(...columns.map((c) => c.value ?? 0)) / 10) * 10)
  const bw = (W - pad.l - pad.r) / columns.length
  const y = (v: number) => pad.t + (1 - v / top) * (H - pad.t - pad.b)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      {[0, 0.5, 1].map((t) => {
        const g = Math.round(top * t)
        return (
          <g key={g}>
            <line x1={pad.l} x2={W - pad.r} y1={y(g)} y2={y(g)} stroke="currentColor" opacity={0.12} />
            <text x={pad.l - 6} y={y(g) + 4} textAnchor="end" fontSize="10" fill="currentColor" opacity={0.6}>
              {g}
              {unit}
            </text>
          </g>
        )
      })}
      {columns.map((c, i) => {
        const x = pad.l + i * bw + bw * 0.15
        const w = bw * 0.7
        return (
          <g key={c.label}>
            {c.value !== null && (
              <rect
                x={x}
                y={y(c.value)}
                width={w}
                height={Math.max(1, H - pad.b - y(c.value))}
                rx={3}
                fill={levelFill(c.level)}
                opacity={c.faded ? 0.55 : 1}
              >
                <title>
                  {c.label}: {c.value}
                  {unit}
                  {c.note ? ` · ${c.note}` : ''}
                </title>
              </rect>
            )}
            {c.value !== null && (
              <text x={x + w / 2} y={y(c.value) - 3} textAnchor="middle" fontSize="9" fill="currentColor" opacity={0.75}>
                {c.value}
              </text>
            )}
            <text x={x + w / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="currentColor" opacity={0.6}>
              {c.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
