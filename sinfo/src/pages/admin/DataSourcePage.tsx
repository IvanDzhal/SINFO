import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import clsx from 'clsx'
import { api } from '@/services/api'
import { useCan } from '@/hooks/useCan'
import Button from '@/components/Button'
import { RunBadge } from './DataSyncPage'

interface Metric {
  code: string
  name: string
  shortName: string
}
interface Detail {
  id: string
  externalId: string
  sheetName: string | null
  status: string
  lastSyncAt: string | null
  store: { id: string; name: string; code: string | null }
  mappings: { key: string; cells: string[] }[]
  metrics: Metric[]
  keys: string[]
}
interface Issue {
  key: string
  code: string
  severity: 'error' | 'warning'
  message: string
}
interface Preview {
  grid: string[][]
  values: Record<string, number | null>
  issues: Issue[]
}
interface Suggestion {
  key: string
  cells: string[]
  confidence: 'high' | 'low'
  hint: string
}
interface SourceOption {
  id: string
  store: { name: string }
}

const colLetters = (n: number) => {
  let s = ''
  let x = n
  while (x > 0) {
    const r = (x - 1) % 26
    s = String.fromCharCode(65 + r) + s
    x = Math.floor((x - 1) / 26)
  }
  return s
}

const A1_RE = /^[A-Za-z]{1,3}[1-9][0-9]{0,4}$/
// «J5, K5», «J5+K5», «J5 K5» → ['J5','K5']
const parseCells = (text: string) =>
  text
    .split(/[\s,;+]+/)
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean)
const validCells = (cells: string[]) => cells.every((c) => A1_RE.test(c))

function errText(e: any) {
  const m = e?.response?.data?.message
  return Array.isArray(m) ? m.join('; ') : (m ?? 'Не вдалося виконати дію')
}

const num = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : v.toLocaleString('uk-UA')

export default function DataSourcePage() {
  const { id } = useParams()
  const can = useCan()
  const canManage = can('datasync.manage')

  const [detail, setDetail] = useState<Detail | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<Preview | null>(null)
  const [active, setActive] = useState<string | null>(null)
  const [others, setOthers] = useState<SourceOption[]>([])
  const [copyFrom, setCopyFrom] = useState('')
  const [connection, setConnection] = useState({ externalId: '', sheetName: '' })
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [lastRun, setLastRun] = useState<{ status: any; message: string | null } | null>(null)

  function adopt(d: Detail) {
    setDetail(d)
    setDraft(Object.fromEntries(d.keys.map((k) => [k, (d.mappings.find((m) => m.key === k)?.cells ?? []).join(', ')])))
    setConnection({ externalId: d.externalId, sheetName: d.sheetName ?? '' })
  }

  useEffect(() => {
    api.get<Detail>(`/datasync/sources/${id}`).then((r) => adopt(r.data)).catch((e) => setMsg({ text: errText(e), ok: false }))
    api
      .get<SourceOption[]>('/datasync/sources')
      .then((r) => setOthers(r.data.filter((s) => s.id !== id)))
      .catch(() => {})
  }, [id])

  async function act<T>(name: string, fn: () => Promise<T>, ok?: (r: T) => string) {
    setBusy(name)
    setMsg(null)
    try {
      const r = await fn()
      if (ok) setMsg({ text: ok(r), ok: true })
      return r
    } catch (e) {
      setMsg({ text: errText(e), ok: false })
    } finally {
      setBusy(null)
    }
  }

  const invalidKeys = useMemo(
    () => Object.entries(draft).filter(([, v]) => !validCells(parseCells(v))).map(([k]) => k),
    [draft],
  )

  // комірки, що вже використовуються (підсвітка в сітці)
  const mapped = useMemo(() => {
    const m = new Map<string, string>()
    for (const [k, v] of Object.entries(draft)) parseCells(v).forEach((c) => m.set(c, k))
    return m
  }, [draft])

  async function save() {
    if (!detail) return
    const r = await act(
      'save',
      () =>
        api.put<Detail>(`/datasync/sources/${detail.id}/mappings`, {
          mappings: detail.keys.map((key) => ({ key, cells: parseCells(draft[key] ?? '') })),
        }),
      () => 'Збережено',
    )
    if (r) adopt(r.data)
  }

  async function saveConnection() {
    if (!detail) return
    await act(
      'conn',
      () =>
        api.patch(`/datasync/sources/${detail.id}`, {
          externalId: connection.externalId,
          sheetName: connection.sheetName.trim() || null,
        }),
      () => 'Підключення оновлено',
    )
    const r = await api.get<Detail>(`/datasync/sources/${detail.id}`)
    adopt(r.data)
  }

  async function toggleStatus() {
    if (!detail) return
    await act('status', () =>
      api.patch(`/datasync/sources/${detail.id}`, {
        status: detail.status === 'active' ? 'inactive' : 'active',
      }),
    )
    const r = await api.get<Detail>(`/datasync/sources/${detail.id}`)
    adopt(r.data)
  }

  async function loadPreview() {
    if (!detail) return
    // значення в підказках рахуються за збереженими комірками
    const r = await act('preview', () => api.post<Preview>(`/datasync/sources/${detail.id}/preview`))
    if (r) setPreview(r.data)
  }

  async function suggest() {
    if (!detail) return
    const r = await act('suggest', () => api.post<Suggestion[]>(`/datasync/sources/${detail.id}/suggest`))
    if (!r) return
    if (r.data.length === 0) {
      setMsg({ text: 'Не вдалося знайти відповідності автоматично. Позначте комірки вручну.', ok: false })
      return
    }
    setDraft((d) => {
      const next = { ...d }
      // лише порожні ключі: ручні налаштування не перезаписуємо
      for (const s of r.data) if (!next[s.key]?.trim()) next[s.key] = s.cells.join(', ')
      return next
    })
    setMsg({
      text: `Запропоновано комірок: ${r.data.length}. Перевірте й збережіть. Низька впевненість: ${r.data.filter((s) => s.confidence === 'low').length}.`,
      ok: true,
    })
  }

  async function copy() {
    if (!detail || !copyFrom) return
    const r = await act(
      'copy',
      () => api.post<Detail>(`/datasync/sources/${detail.id}/mappings/copy`, { fromSourceId: copyFrom }),
      () => 'Розташування комірок скопійовано',
    )
    if (r) adopt(r.data)
  }

  async function runSync() {
    if (!detail) return
    const r = await act('sync', () => api.post<any>(`/datasync/sources/${detail.id}/sync`))
    if (r) {
      setLastRun({ status: r.data.status, message: r.data.errorMessage })
      setMsg({
        text:
          r.data.status === 'success'
            ? `Синхронізовано: збережено ${r.data.recordsSaved}, оновлено ${r.data.recordsUpdated}`
            : (r.data.errorMessage ?? 'Синхронізація завершилась з помилками'),
        ok: r.data.status === 'success',
      })
    }
  }

  function clickCell(ref: string, additive: boolean) {
    if (!active || !canManage) return
    setDraft((d) => {
      const cur = parseCells(d[active] ?? '')
      const next = additive ? (cur.includes(ref) ? cur.filter((c) => c !== ref) : [...cur, ref]) : [ref]
      return { ...d, [active]: next.join(', ') }
    })
  }

  if (!detail) {
    return <p className={msg && !msg.ok ? 'text-danger' : 'text-muted'}>{msg?.text ?? 'Завантаження...'}</p>
  }

  const issueByKey = new Map<string, Issue>()
  preview?.issues.forEach((i) => issueByKey.set(i.key, i))

  const labelOf = (key: string) => {
    if (key === 'meta.days_passed') return 'Днів минуло'
    if (key === 'meta.days_left') return 'Днів залишилось'
    return key
  }

  const MappingInput = ({ k }: { k: string }) => {
    const value = draft[k] ?? ''
    const bad = invalidKeys.includes(k)
    const issue = issueByKey.get(k)
    const shown = preview?.values[k]
    return (
      <div>
        <input
          value={value}
          disabled={!canManage}
          onFocus={() => setActive(k)}
          onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
          placeholder="напр. C5"
          className={clsx(
            'w-28 rounded-lg border bg-surface-2 px-2 py-1 text-sm outline-none',
            active === k ? 'border-accent' : 'border-border',
            bad && 'border-danger',
          )}
        />
        {preview && !bad && (
          <p className={clsx('mt-0.5 text-xs', issue?.severity === 'error' ? 'text-danger' : 'text-muted')}>
            {issue ? issue.message : num(shown)}
          </p>
        )}
      </div>
    )
  }

  const rows = preview ? preview.grid.length : 0
  const cols = preview ? Math.max(26, ...preview.grid.map((r) => r.length)) : 0

  return (
    <div>
      <Link to="/admin/data-sync" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} /> Синхронізація
      </Link>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            {detail.store.name}
            {detail.store.code && <span className="ml-2 text-sm text-muted">{detail.store.code}</span>}
          </h2>
          <p className="text-sm text-muted">
            {detail.status === 'active' ? 'Синхронізація увімкнена' : 'Синхронізація вимкнена'}
            {lastRun && (
              <>
                {' · '}
                <RunBadge status={lastRun.status} />
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('datasync.run') && detail.status === 'active' && (
            <Button variant="ghost" onClick={runSync} disabled={busy !== null}>
              <RefreshCw size={16} className={clsx(busy === 'sync' && 'animate-spin')} />
              Синхронізувати зараз
            </Button>
          )}
          {canManage && (
            <Button variant="ghost" onClick={toggleStatus} disabled={busy !== null}>
              {detail.status === 'active' ? 'Вимкнути' : 'Увімкнути'}
            </Button>
          )}
        </div>
      </div>

      {msg && (
        <p
          className={clsx(
            'mb-4 rounded-xl border border-border bg-surface px-3 py-2 text-sm',
            msg.ok ? 'text-success' : 'text-danger',
          )}
        >
          {msg.text}
        </p>
      )}

      <section className="mb-6 rounded-2xl border border-border bg-surface p-4">
        <h3 className="mb-3 font-medium">Підключення</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Посилання або ID таблиці</span>
            <input
              value={connection.externalId}
              disabled={!canManage}
              onChange={(e) => setConnection((c) => ({ ...c, externalId: e.target.value }))}
              className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Аркуш (порожньо — перший)</span>
            <input
              value={connection.sheetName}
              disabled={!canManage}
              onChange={(e) => setConnection((c) => ({ ...c, sheetName: e.target.value }))}
              className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </label>
        </div>
        {canManage && (
          <div className="mt-3">
            <Button variant="ghost" onClick={saveConnection} disabled={busy !== null}>
              Зберегти підключення
            </Button>
          </div>
        )}
      </section>

      <section className="mb-6 rounded-2xl border border-border bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium">Які комірки рахувати</h3>
          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={loadPreview} disabled={busy !== null}>
                {busy === 'preview' ? 'Читаю…' : 'Показати таблицю'}
              </Button>
              <Button variant="ghost" onClick={suggest} disabled={busy !== null}>
                Підібрати автоматично
              </Button>
              {others.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <select
                    value={copyFrom}
                    onChange={(e) => setCopyFrom(e.target.value)}
                    className="rounded-xl border border-border bg-surface px-2 py-2 text-sm"
                  >
                    <option value="">Копіювати з…</option>
                    {others.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.store.name}
                      </option>
                    ))}
                  </select>
                  <Button variant="ghost" onClick={copy} disabled={!copyFrom || busy !== null}>
                    Копіювати
                  </Button>
                </span>
              )}
            </div>
          )}
        </div>
        <p className="mb-3 text-xs text-muted">
          Вкажіть комірку (C5) або кілька через кому — вони підсумовуються (J5, K5). Натисніть поле, а
          потім комірку в таблиці нижче; Shift — додати ще одну комірку до суми.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-1 pr-3 font-medium">Показник</th>
                <th className="py-1 pr-3 font-medium">План</th>
                <th className="py-1 pr-3 font-medium">Факт (з початку місяця)</th>
                <th className="py-1 pr-3 font-medium">За день</th>
              </tr>
            </thead>
            <tbody>
              {detail.metrics.map((m) => (
                <tr key={m.code} className="border-t border-border align-top">
                  <td className="py-2 pr-3 font-medium">{m.name}</td>
                  <td className="py-2 pr-3">
                    <MappingInput k={`plan.${m.code}`} />
                  </td>
                  <td className="py-2 pr-3">
                    <MappingInput k={`fact.${m.code}`} />
                  </td>
                  <td className="py-2 pr-3">
                    <MappingInput k={`day.${m.code}`} />
                  </td>
                </tr>
              ))}
              {['meta.days_passed', 'meta.days_left'].map((k) => (
                <tr key={k} className="border-t border-border align-top">
                  <td className="py-2 pr-3 font-medium">{labelOf(k)}</td>
                  <td className="py-2 pr-3" colSpan={3}>
                    <MappingInput k={k} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {invalidKeys.length > 0 && (
          <p className="mt-2 text-xs text-danger">
            Некоректні адреси комірок: {invalidKeys.map(labelOf).join(', ')}
          </p>
        )}

        {canManage && (
          <div className="mt-4">
            <Button onClick={save} disabled={busy !== null || invalidKeys.length > 0}>
              {busy === 'save' ? 'Збереження…' : 'Зберегти комірки'}
            </Button>
          </div>
        )}
      </section>

      {preview && (
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h3 className="mb-1 font-medium">Таблиця</h3>
          <p className="mb-3 text-xs text-muted">
            {active
              ? `Обрано поле: ${labelOf(active)}. Натисніть комірку, щоб призначити її.`
              : 'Натисніть поле показника вище, щоб призначати комірки кліком.'}
          </p>
          <div className="max-h-[480px] overflow-auto rounded-xl border border-border">
            <table className="border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-surface-2 text-muted">
                <tr>
                  <th className="w-8 border border-border px-1" />
                  {Array.from({ length: cols }, (_, c) => (
                    <th key={c} className="min-w-16 border border-border px-1 font-medium">
                      {colLetters(c + 1)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: rows }, (_, r) => (
                  <tr key={r}>
                    <th className="sticky left-0 border border-border bg-surface-2 px-1 font-medium text-muted">
                      {r + 1}
                    </th>
                    {Array.from({ length: cols }, (_, c) => {
                      const ref = `${colLetters(c + 1)}${r + 1}`
                      const owner = mapped.get(ref)
                      const text = preview.grid[r]?.[c] ?? ''
                      return (
                        <td
                          key={c}
                          title={owner ? `${labelOf(owner)} · ${ref}` : ref}
                          onClick={(e) => clickCell(ref, e.shiftKey)}
                          className={clsx(
                            'max-w-40 truncate border border-border px-1.5 py-0.5',
                            active && canManage && 'cursor-pointer hover:bg-accent-soft',
                            owner === active && 'bg-accent-soft font-medium text-accent',
                            owner && owner !== active && 'bg-success-soft',
                          )}
                        >
                          {text}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">
            Значення під полями показано за збереженими комірками — після змін натисніть «Зберегти» й
            «Показати таблицю» ще раз. Помаранчевим позначено комірки поточного поля, зеленим — уже використані іншими полями.
          </p>
        </section>
      )}
    </div>
  )
}
