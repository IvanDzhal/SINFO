import { useState } from 'react'
import { MessageSquareWarning } from 'lucide-react'
import { api } from '@/services/api'
import { getErrorMessage } from '@/utils/errors'

const KINDS: [string, string][] = [
  ['outdated', 'Застаріла інформація'],
  ['error', 'Є помилка'],
  ['unclear', 'Незрозуміло'],
  ['other', 'Інше'],
]

// Невелика форма під статтею: читач повідомляє автору, що з матеріалом не так
export default function FeedbackBox({ itemId }: { itemId: string }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState('outdated')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function send() {
    setBusy(true)
    setError('')
    try {
      await api.post(`/knowledge/items/${itemId}/feedback`, { kind, comment })
      setDone(true)
      setOpen(false)
      setComment('')
    } catch (err) {
      setError(getErrorMessage(err, 'Не вдалося надіслати'))
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return <p className="mt-6 text-sm text-success print:hidden">Дякуємо, відгук передано автору.</p>
  }

  return (
    <div className="mt-6 print:hidden">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
        >
          <MessageSquareWarning size={16} /> Повідомити про проблему в матеріалі
        </button>
      ) : (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="mb-2 font-medium">Що не так з цим матеріалом?</p>
          <div className="mb-3 flex flex-wrap gap-2">
            {KINDS.map(([v, label]) => (
              <button
                key={v}
                onClick={() => setKind(v)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  kind === v ? 'border-accent bg-accent-soft text-accent' : 'border-border text-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Коментар (необов’язково)"
            className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
          />
          {error && <p className="mt-1 text-sm text-danger">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button
              onClick={send}
              disabled={busy}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Надіслати
            </button>
            <button onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-muted">
              Скасувати
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
