import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { api } from '@/services/api'
import Button from '@/components/Button'
import { getErrorMessage } from '@/utils/errors'

function urlBase64ToUint8Array(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
const standalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true

type State = 'loading' | 'unsupported' | 'install-ios' | 'off' | 'on' | 'denied' | 'disabled'

// Вмикає push-сповіщення в цьому браузері або встановленому додатку
export default function PushToggle() {
  const [state, setState] = useState<State>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function detect() {
    if (isIos && !standalone) return setState('install-ios')
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return setState('unsupported')
    }
    try {
      const { data } = await api.get<{ key: string | null }>('/notifications/push/key')
      if (!data.key) return setState('disabled')
    } catch {
      return setState('unsupported')
    }
    if (Notification.permission === 'denied') return setState('denied')
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    setState(sub && Notification.permission === 'granted' ? 'on' : 'off')
  }

  useEffect(() => {
    detect().catch(() => setState('unsupported'))
  }, [])

  async function enable() {
    setBusy(true)
    setError('')
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') return setState(perm === 'denied' ? 'denied' : 'off')
      const { data } = await api.get<{ key: string | null }>('/notifications/push/key')
      if (!data.key) return setState('disabled')
      const reg = await navigator.serviceWorker.ready
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(data.key),
        }))
      await api.post('/notifications/push/subscribe', sub.toJSON())
      setState('on')
    } catch (err) {
      setError(getErrorMessage(err, 'Не вдалося увімкнути сповіщення'))
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    setError('')
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await api.post('/notifications/push/unsubscribe', { endpoint: sub.endpoint })
        await sub.unsubscribe()
      }
      setState('off')
    } catch (err) {
      setError(getErrorMessage(err, 'Не вдалося вимкнути сповіщення'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Bell size={16} />
        Push-сповіщення
      </h3>
      <p className="mb-3 text-sm text-muted">
        Нові обов'язкові матеріали, призначені тести та нагадування про терміни приходитимуть на
        телефон, навіть коли портал закритий.
      </p>

      {state === 'loading' && <p className="text-sm text-muted">Перевірка…</p>}
      {state === 'install-ios' && (
        <p className="text-sm">
          На iPhone сповіщення працюють лише у встановленому додатку: відкрийте портал у Safari, натисніть
          «Поділитися» → «На екран “Додому”», запустіть додаток з іконки й увімкніть сповіщення тут.
        </p>
      )}
      {state === 'unsupported' && (
        <p className="text-sm text-muted">Цей браузер не підтримує push-сповіщення.</p>
      )}
      {state === 'disabled' && (
        <p className="text-sm text-muted">Push-сповіщення на сервері ще не налаштовано.</p>
      )}
      {state === 'denied' && (
        <p className="text-sm text-danger">
          Сповіщення заблоковано в налаштуваннях браузера. Дозвольте їх для цього сайту й оновіть сторінку.
        </p>
      )}
      {state === 'off' && (
        <Button onClick={enable} disabled={busy}>
          <Bell size={16} /> Увімкнути сповіщення
        </Button>
      )}
      {state === 'on' && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-success">Увімкнено на цьому пристрої</span>
          <Button variant="ghost" onClick={disable} disabled={busy}>
            <BellOff size={16} /> Вимкнути
          </Button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  )
}
