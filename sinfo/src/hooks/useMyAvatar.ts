import { useEffect, useState } from 'react'
import { api } from '@/services/api'

type Listener = (url: string | null) => void

const listeners = new Set<Listener>()
let cached: { url: string | null } | null = null

// Після завантаження/видалення аватарки оновлюємо шапку без перезавантаження
export function setMyAvatar(url: string | null) {
  cached = { url }
  listeners.forEach((l) => l(url))
}

export function useMyAvatar() {
  const [url, setUrl] = useState<string | null>(cached?.url ?? null)

  useEffect(() => {
    listeners.add(setUrl)
    if (!cached) {
      api
        .get<{ url: string | null }>('/profile/avatar-link')
        .then((r) => setMyAvatar(r.data.url))
        .catch(() => {})
    }
    return () => {
      listeners.delete(setUrl)
    }
  }, [])

  return url
}
