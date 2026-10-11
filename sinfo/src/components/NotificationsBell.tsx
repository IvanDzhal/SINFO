import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Megaphone } from 'lucide-react'
import clsx from 'clsx'
import { api } from '@/services/api'

interface Notif {
  id: string
  kind: string
  title: string
  body: string
  link: string
  readAt: string | null
  createdAt: string
}

function ago(iso: string) {
  const min = Math.floor(Math.max(0, Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'щойно'
  if (min < 60) return `${min} хв тому`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} год тому`
  return new Date(iso).toLocaleDateString('uk-UA')
}

export default function NotificationsBell() {
  const [items, setItems] = useState<Notif[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  async function load() {
    try {
      const r = await api.get<{ unread: number; items: Notif[] }>('/notifications')
      setItems(r.data.items)
      setUnread(r.data.unread)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    load()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load()
    }, 30000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  function openItem(n: Notif) {
    setOpen(false)
    if (!n.readAt) {
      setItems((l) => l.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)))
      setUnread((u) => Math.max(0, u - 1))
      api.post(`/notifications/${n.id}/read`).catch(() => {})
    }
    navigate(n.link)
  }

  async function readAll() {
    await api.post('/notifications/read-all').catch(() => {})
    load()
  }

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Сповіщення"
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-medium text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-80 max-w-[85vw] overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm font-medium">Сповіщення</p>
            {unread > 0 && (
              <button onClick={readAll} className="text-xs text-accent hover:underline">
                Позначити все прочитаним
              </button>
            )}
          </div>
          {items.length === 0 && (
            <p className="border-t border-border px-4 py-6 text-center text-sm text-muted">
              Сповіщень поки немає
            </p>
          )}
          <div className="max-h-96 overflow-y-auto">
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => openItem(n)}
                className={clsx(
                  'flex w-full items-start gap-3 border-t border-border px-4 py-3 text-left hover:bg-surface-2',
                  !n.readAt && 'bg-accent-soft/40',
                )}
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <Megaphone size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{n.title}</span>
                  {n.body && <span className="block truncate text-xs text-muted">{n.body}</span>}
                  <span className="mt-0.5 block text-xs text-muted">{ago(n.createdAt)}</span>
                </span>
                {!n.readAt && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}