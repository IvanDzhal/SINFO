import { useEffect, useState } from 'react'
import { api } from '@/services/api'

export function useFetch<T>(url: string) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    api
      .get(url)
      .then((r) => {
        if (cancelled) return
        setData(r.data)
        setError('')
      })
      .catch(() => {
        if (!cancelled) setError('Не вдалося завантажити дані')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [url, tick])

  return { data, loading, error, reload: () => setTick((t) => t + 1) }
}