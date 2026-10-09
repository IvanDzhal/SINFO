import { useEffect, useState } from 'react'
import { api } from '@/services/api'

export function useFetch<T>(url: string) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    api
      .get(url)
      .then((r) => setData(r.data))
      .catch(() => setError('Не вдалося завантажити дані'))
      .finally(() => setLoading(false))
  }, [url])

  return { data, loading, error }
}