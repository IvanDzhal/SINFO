import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import { useThemeStore } from '@/store/useThemeStore'
import Modal from './Modal'
import RichContent from './RichContent'

interface VersionRow {
  id: string
  version: number
  createdAt: string
  author: { firstName: string; lastName: string }
}

interface VersionFull {
  version: number
  title: string
  description: string
  content: unknown
}

export default function VersionsModal({
  itemId,
  current,
  onClose,
}: {
  itemId: string
  current: number
  onClose: () => void
}) {
  const theme = useThemeStore((s) => s.theme)
  const [rows, setRows] = useState<VersionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<VersionFull | null>(null)

  useEffect(() => {
    api
      .get<VersionRow[]>(`/knowledge/items/${itemId}/versions`)
      .then((r) => setRows(r.data))
      .catch(() => setError('Не вдалося завантажити історію'))
      .finally(() => setLoading(false))
  }, [itemId])

  function show(version: number) {
    setError('')
    api
      .get<VersionFull>(`/knowledge/items/${itemId}/versions/${version}`)
      .then((r) => setOpen(r.data))
      .catch(() => setError('Не вдалося завантажити версію'))
  }

  return (
    <Modal title={open ? `Версія ${open.version}` : 'Історія версій'} onClose={onClose} wide>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {open ? (
        <div>
          <button
            onClick={() => setOpen(null)}
            className="mb-3 text-sm text-accent hover:underline"
          >
            ← До списку версій
          </button>
          <h4 className="mb-1 text-lg font-semibold">{open.title}</h4>
          {open.description && <p className="mb-3 text-sm text-muted">{open.description}</p>}
          <RichContent key={open.version} content={open.content} theme={theme} />
        </div>
      ) : (
        <div>
          {loading && <p className="text-muted">Завантаження...</p>}
          {!loading && rows.length === 0 && <p className="text-muted">Версій поки немає</p>}
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2.5 first:border-t-0"
            >
              <div>
                <p className="text-sm font-medium">
                  Версія {r.version}
                  {r.version === current && (
                    <span className="ml-2 rounded-full bg-success-soft px-2 py-0.5 text-xs text-success">
                      поточна
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted">
                  {r.author.firstName} {r.author.lastName} ·{' '}
                  {new Date(r.createdAt).toLocaleString('uk-UA')}
                </p>
              </div>
              <button
                onClick={() => show(r.version)}
                className="text-sm text-accent hover:underline"
              >
                Переглянути
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}