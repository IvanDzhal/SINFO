import { useEffect, useState } from 'react'
import { api } from '@/services/api'

export function useFetch<T>(url: string) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    api
      .get(url)
      .then((r) => {
        setData(r.data)
        setError('')
      })
      .catch(() => setError('Не вдалося завантажити дані'))
      .finally(() => setLoading(false))
  }, [url, tick])

  return { data, loading, error, reload: () => setTick((t) => t + 1) }
}