import axios from 'axios'

export function getErrorMessage(err: unknown, fallback: string) {
  const msg = axios.isAxiosError(err) ? err.response?.data?.message : null
  return Array.isArray(msg) ? msg.join(', ') : (msg ?? fallback)
}