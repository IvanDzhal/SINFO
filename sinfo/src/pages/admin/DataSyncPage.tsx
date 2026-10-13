import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, RefreshCw } from 'lucide-react'
import clsx from 'clsx'
import { api } from '@/services/api'
import { useCan } from '@/hooks/useCan'
import Button from '@/components/Button'
import Modal from '@/components/Modal'
import { Input, Select } from '@/components/Field'

type Status = 'pending' | 'running' | 'success' | 'partial' | 'failed'

interface Run {
  id: string
  status: Status
  trigger: string
  startedAt: string
  finishedAt: string | null
  recordsRead: number
  recordsSaved: number
  recordsUpdated: number
  errorsCount: number
  errorMessage: string | null
  source?: { id: string; store: { id: string; name: string; code: string | null } }
}

interface Source {
  id: string
  externalId: string
  sheetName: string | null
  status: string
  lastSyncAt: string | null
  lastSuccessfulSyncAt: string | null
  store: { id: string; name: string; code: string | null; region: { name: string } }
  lastRun: Run | null
  missingKeys: string[]
}

interface StoreOption {
  id: string
  name: string
  code: string | null
}

const STATUS: Record<Status, { label: string; cls: string }> = {
  pending: { label: 'В черзі', cls: 'bg-surface-2 text-muted' },
  running: { label: 'Виконується', cls: 'bg-accent-soft text-accent' },
  success: { label: 'Успішно', cls: 'bg-success-soft text-success' },
  partial: { label: 'Частково', cls: 'bg-accent-soft text-accent' },
  failed: { label: 'Помилка', cls: 'bg-danger/10 text-danger' },
}

export function RunBadge({ status }: { status: Status }) {
  const s = STATUS[status]
  return <span className={clsx('rounded-full px-2.5 py-0.5 text-xs font-medium', s.cls)}>{s.label}</span>
}

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

function errText(e: any) {
  const m = e?.response?.data?.message
  return Array.isArray(m) ? m.join('; ') : (m ?? 'Не вдалося виконати дію')
}

function ConnectModal({
  sources,
  onClose,
  onDone,
}: {
  sources: Source[]
  onClose: () => void
  onDone: () => void
}) {
  const [stores, setStores] = useState<StoreOption[]>([])
  const [storeId, setStoreId] = useState('')
  const [externalId, setExternalId] = useState('')
  const [sheetName, setSheetName] = useState('')
  const [copyFrom, setCopyFrom] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get<StoreOption[]>('/core/stores').then((r) => {
      const used = new Set(sources.map((s) => s.store.id))
      setStores(r.data.filter((s) => !used.has(s.id)))
    })
  }, [sources])

  async function submit() {
    setSaving(true)
    setError('')
    try {
      await api.post('/datasync/sources', {
        storeId,
        externalId,
        sheetName: sheetName || undefined,
        copyFromSourceId: copyFrom || undefined,
      })
      onDone()
    } catch (e) {
      setError(errText(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Підключити таблицю" onClose={onClose}>
      <div className="space-y-3">
        <Select label="Магазин" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
          <option value="">Оберіть магазин</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.code ? ` (${s.code})` : ''}
            </option>
          ))}
        </Select>
        <p className="-mt-2 text-xs text-muted">
          Немає потрібного магазину? Спершу створіть його в розділі «Магазини».
        </p>
        <Input
          label="Посилання або ID Google таблиці"
          value={externalId}
          onChange={(e) => setExternalId(e.target.value)}
        />
        <Input
          label="Назва аркуша (порожньо — перший аркуш)"
          value={sheetName}
          onChange={(e) => setSheetName(e.target.value)}
        />
        <Select
          label="Скопіювати розташування комірок з магазину"
          value={copyFrom}
          onChange={(e) => setCopyFrom(e.target.value)}
        >
          <option value="">Налаштую вручну</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.store.name}
            </option>
          ))}
        </Select>
        <p className="text-xs text-muted">
          Таблицю потрібно відкрити для service account (email зі службового ключа) з правом
          перегляду.
        </p>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Скасувати
          </Button>
          <Button onClick={submit} disabled={saving || !storeId || !externalId}>
            Підключити
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default function DataSyncPage() {
  const can = useCan()
  const [sources, setSources] = useState<Source[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [connect, setConnect] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  function load() {
    Promise.all([api.get<Source[]>('/datasync/sources'), api.get<Run[]>('/datasync/runs?limit=30')])
      .then(([s, r]) => {
        setSources(s.data)
        setRuns(r.data)
        setError('')
      })
      .catch((e) => setError(errText(e)))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  async function syncOne(id: string) {
    setBusy(id)
    setMessage('')
    try {
      const r = await api.post<Run>(`/datasync/sources/${id}/sync`)
      setMessage(
        r.data.status === 'success'
          ? 'Синхронізацію виконано'
          : (r.data.errorMessage ?? 'Синхронізація завершилась з помилками'),
      )
    } catch (e) {
      setMessage(errText(e))
    } finally {
      setBusy(null)
      load()
    }
  }

  async function syncAll() {
    setBusy('all')
    setMessage('')
    try {
      await api.post('/datasync/sync')
      setMessage('Синхронізацію всіх магазинів запущено у фоні. Оновіть сторінку за хвилину.')
    } catch (e) {
      setMessage(errText(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Синхронізація даних</h2>
        <div className="flex gap-2">
          {can('datasync.run') && (
            <Button variant="ghost" onClick={syncAll} disabled={busy !== null}>
              <RefreshCw size={16} className={clsx(busy === 'all' && 'animate-spin')} />
              Синхронізувати все
            </Button>
          )}
          {can('datasync.manage') && (
            <Button onClick={() => setConnect(true)}>
              <Plus size={16} /> Підключити таблицю
            </Button>
          )}
        </div>
      </div>
      <p className="mb-4 text-sm text-muted">
        Дані з Google Sheets автоматично потрапляють у базу щогодини (09–20) та о 21:05. Аналітика
        читає лише базу, не таблиці.
      </p>
      {message && (
        <p className="mb-3 rounded-xl border border-border bg-surface px-3 py-2 text-sm">{message}</p>
      )}
      {loading && <p className="text-muted">Завантаження...</p>}
      {error && <p className="text-danger">{error}</p>}

      {!loading && !error && (
        <>
          <div className="mb-8 overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-surface-2 text-left text-muted">
                <tr>
                  {['Магазин', 'Статус', 'Остання спроба', 'Остання успішна', 'Стан', ''].map((h) => (
                    <th key={h} className="px-4 py-2.5 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sources.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-muted">
                      Таблиць ще не підключено
                    </td>
                  </tr>
                )}
                {sources.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">
                        {s.store.name}
                        {s.store.code && <span className="ml-2 text-xs text-muted">{s.store.code}</span>}
                      </p>
                      <p className="text-xs text-muted">{s.store.region.name}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      {s.status !== 'active' ? (
                        <span className="text-xs text-muted">Вимкнено</span>
                      ) : s.lastRun ? (
                        <RunBadge status={s.lastRun.status} />
                      ) : (
                        <span className="text-xs text-muted">Ще не запускалась</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">{fmt(s.lastSyncAt)}</td>
                    <td className="px-4 py-2.5">{fmt(s.lastSuccessfulSyncAt)}</td>
                    <td className="max-w-xs px-4 py-2.5 text-xs">
                      {s.lastRun?.errorMessage && (
                        <p className="text-danger">{s.lastRun.errorMessage}</p>
                      )}
                      {s.missingKeys.length > 0 && (
                        <p className="text-accent">Не налаштовано комірок: {s.missingKeys.length}</p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">
                      {can('datasync.run') && s.status === 'active' && (
                        <button
                          className="mr-3 text-accent hover:underline disabled:opacity-50"
                          disabled={busy !== null}
                          onClick={() => syncOne(s.id)}
                        >
                          {busy === s.id ? 'Синхронізація…' : 'Синхронізувати'}
                        </button>
                      )}
                      <Link to={`/admin/data-sync/${s.id}`} className="text-accent hover:underline">
                        Налаштувати
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="mb-2 font-medium">Історія запусків</h3>
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-surface-2 text-left text-muted">
                <tr>
                  {['Початок', 'Магазин', 'Запуск', 'Статус', 'Прочитано', 'Збережено', 'Оновлено', 'Помилки'].map(
                    (h) => (
                      <th key={h} className="px-4 py-2.5 font-medium">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {runs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-muted">
                      Запусків ще не було
                    </td>
                  </tr>
                )}
                {runs.map((r) => (
                  <tr key={r.id} className="border-t border-border align-top">
                    <td className="px-4 py-2.5">{fmt(r.startedAt)}</td>
                    <td className="px-4 py-2.5">{r.source?.store.name}</td>
                    <td className="px-4 py-2.5 text-muted">
                      {{ auto: 'авто', manual: 'вручну', retry: 'повтор' }[r.trigger] ?? r.trigger}
                    </td>
                    <td className="px-4 py-2.5">
                      <RunBadge status={r.status} />
                    </td>
                    <td className="px-4 py-2.5">{r.recordsRead}</td>
                    <td className="px-4 py-2.5">{r.recordsSaved}</td>
                    <td className="px-4 py-2.5">{r.recordsUpdated}</td>
                    <td className="px-4 py-2.5 text-xs">
                      {r.errorsCount > 0 ? (
                        <span className="text-danger">
                          {r.errorsCount}
                          {r.errorMessage ? `: ${r.errorMessage}` : ''}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {connect && (
        <ConnectModal
          sources={sources}
          onClose={() => setConnect(false)}
          onDone={() => {
            setConnect(false)
            load()
          }}
        />
      )}
    </div>
  )
}
