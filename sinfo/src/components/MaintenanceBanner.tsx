import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { api } from '@/services/api'

interface Notice {
  startsAt: string
  endsAt: string
  message: string
}

export const fmtDateTime = (iso: string) => {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// Плашка над шапкою: планові або поточні технічні роботи (керується в адмінці)
export default function MaintenanceBanner() {
  const [notice, setNotice] = useState<Notice | null>(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    let cancelled = false
    const load = () =>
      api
        .get<{ notice: Notice | null }>('/maintenance/active')
        .then((r) => !cancelled && setNotice(r.data.notice))
        .catch(() => {})
    load()
    const t = setInterval(() => {
      setNow(Date.now())
      load()
    }, 5 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  if (!notice || new Date(notice.endsAt).getTime() <= now) return null
  const going = new Date(notice.startsAt).getTime() <= now

  return (
    <div className="flex items-center justify-center gap-2 bg-yellow-300 px-4 py-2 text-center text-sm text-black">
      <AlertTriangle size={16} className="shrink-0" />
      <span>
        {going ? (
          <>
            Тривають технічні роботи до <b>{fmtDateTime(notice.endsAt)}</b>.
          </>
        ) : (
          <>
            Планове технічне обслуговування заплановано з <b>{fmtDateTime(notice.startsAt)}</b> до{' '}
            <b>{fmtDateTime(notice.endsAt)}</b>.
          </>
        )}{' '}
        {notice.message || 'Деякі функції можуть бути тимчасово недоступні.'}
      </span>
    </div>
  )
}
