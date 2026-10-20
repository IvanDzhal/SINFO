import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { api } from '@/services/api'
import { useFetch } from '@/hooks/useFetch'
import { getErrorMessage } from '@/utils/errors'
import { fmtDateTime } from '@/components/MaintenanceBanner'
import Button from '@/components/Button'

interface Row {
  id: string
  startsAt: string
  endsAt: string
  message: string
}

const input = 'w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent'

export default function MaintenancePage() {
  const { data, loading, error, reload } = useFetch<Row>('/maintenance')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function create() {
    setErr('')
    if (!startsAt || !endsAt) return setErr('Вкажіть початок і кінець')
    setSaving(true)
    try {
      await api.post('/maintenance', {
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        message,
      })
      setStartsAt('')
      setEndsAt('')
      setMessage('')
      reload()
    } catch (e) {
      setErr(getErrorMessage(e, 'Не вдалося зберегти'))
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Видалити запис? Плашка зникне одразу.')) return
    await api.delete(`/maintenance/${id}`)
    reload()
  }

  const now = Date.now()
  const status = (r: Row) =>
    new Date(r.endsAt).getTime() <= now
      ? 'Завершено'
      : new Date(r.startsAt).getTime() <= now
        ? 'Триває'
        : 'Заплановано'

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Технічні роботи</h2>
        <p className="text-sm text-muted">
          Жовта плашка над шапкою показується всім одразу після створення запису і до завершення робіт.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Початок
            <input type="datetime-local" className={input} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </label>
          <label className="text-sm">
            Кінець
            <input type="datetime-local" className={input} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </label>
        </div>
        <label className="mt-3 block text-sm">
          Текст після дат (необов&apos;язково)
          <input
            className={input}
            maxLength={300}
            placeholder="Деякі функції можуть бути тимчасово недоступні."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </label>
        {err && <p className="mt-2 text-sm text-danger">{err}</p>}
        <div className="mt-3">
          <Button onClick={create} disabled={saving}>
            {saving ? 'Збереження...' : 'Додати'}
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {loading && <p className="px-4 py-6 text-center text-muted">Завантаження...</p>}
        {error && <p className="px-4 py-6 text-center text-danger">{error}</p>}
        {!loading && !error && data.length === 0 && <p className="px-4 py-6 text-center text-muted">Записів немає</p>}
        {data.map((r) => (
          <div key={r.id} className="flex items-center gap-3 border-t border-border px-4 py-3 first:border-t-0">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {fmtDateTime(r.startsAt)} — {fmtDateTime(r.endsAt)}
              </p>
              {r.message && <p className="truncate text-sm text-muted">{r.message}</p>}
            </div>
            <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-muted">{status(r)}</span>
            <button onClick={() => remove(r.id)} title="Видалити" className="text-muted hover:text-danger">
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
