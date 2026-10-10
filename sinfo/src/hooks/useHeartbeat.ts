import { useEffect } from 'react'
import { api } from '@/services/api'

export function useHeartbeat() {
  useEffect(() => {
    const ping = () => {
      if (document.visibilityState === 'visible') api.post('/presence/heartbeat').catch(() => {})
    }
    ping()
    const t = setInterval(ping, 30000)
    document.addEventListener('visibilitychange', ping)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', ping)
    }
  }, [])
}