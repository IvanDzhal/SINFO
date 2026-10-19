import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Send } from 'lucide-react'
import { api } from '@/services/api'
import { useAuthStore } from '@/store/useAuthStore'
import { setMyAvatar, useMyAvatar } from '@/hooks/useMyAvatar'
import Avatar from '@/components/Avatar'
import Button from '@/components/Button'
import { getErrorMessage } from '@/utils/errors'
import PushToggle from '@/components/PushToggle'

const MAX_MB = 3

export default function ProfileSettingsPage() {
  const user = useAuthStore((s) => s.user)
  const avatar = useMyAvatar()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!user) return null

  async function upload(file: File | undefined) {
    if (!file) return
    setError('')
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Файл завеликий. Максимум ${MAX_MB} МБ`)
      return
    }
    const form = new FormData()
    form.append('file', file)
    setBusy(true)
    try {
      const r = await api.post<{ url: string | null }>('/profile/avatar', form)
      setMyAvatar(r.data.url)
    } catch (e) {
      setError(getErrorMessage(e, 'Не вдалося завантажити аватарку'))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  async function remove() {
    setError('')
    setBusy(true)
    try {
      await api.delete('/profile/avatar')
      setMyAvatar(null)
    } catch (e) {
      setError(getErrorMessage(e, 'Не вдалося видалити аватарку'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link to="/profile" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} />
        До профілю
      </Link>
      <h2 className="text-xl font-semibold">Налаштування профілю</h2>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h3 className="mb-3 text-sm font-semibold">Аватарка</h3>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar firstName={user.firstName} lastName={user.lastName} url={avatar} size="lg" />
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => input.current?.click()} disabled={busy}>
                {avatar ? 'Змінити' : 'Завантажити'}
              </Button>
              {avatar && (
                <Button variant="ghost" onClick={remove} disabled={busy}>
                  Видалити
                </Button>
              )}
            </div>
            <p className="text-xs text-muted">PNG, JPG або WebP, до {MAX_MB} МБ. Без фото показуються ініціали.</p>
          </div>
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => upload(e.target.files?.[0])}
          />
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </section>

      <PushToggle />

      <section className="rounded-xl border border-border bg-surface p-5 opacity-70">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
          <Send size={16} />
          Telegram-бот
        </h3>
        <p className="text-sm text-muted">
          Прив'язка до Telegram для сповіщень і нагадувань з'явиться пізніше.
        </p>
      </section>
    </div>
  )
}
