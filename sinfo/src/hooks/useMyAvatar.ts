import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import { useAuthStore } from '@/store/useAuthStore'

type Listener = (url: string | null) => void

const REFRESH_MS = 45 * 60 * 1000 // підписане посилання діє годину

const listeners = new Set<Listener>()
let cached: { userId: string; url: string | null } | null = null

// Після завантаження/видалення аватарки оновлюємо шапку без перезавантаження
export function setMyAvatar(url: string | null) {
  const userId = useAuthStore.getState().user?.id
  if (userId) cached = { userId, url }
  listeners.forEach((l) => l(url))
}

function load() {
  api
    .get<{ url: string | null }>('/profile/avatar-link')
    .then((r) => setMyAvatar(r.data.url))
    .catch(() => {})
}

export function useMyAvatar() {
  const userId = useAuthStore((s) => s.user?.id)
  const [url, setUrl] = useState<string | null>(cached && cached.userId === userId ? cached.url : null)

  useEffect(() => {
    if (!userId) return
    listeners.add(setUrl)
    if (cached && cached.userId === userId) setUrl(cached.url)
    else {
      setUrl(null)
      load()
    }
    const timer = setInterval(load, REFRESH_MS)
    return () => {
      listeners.delete(setUrl)
      clearInterval(timer)
    }
  }, [userId])

  return url
}
