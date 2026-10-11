import { api } from '@/services/api'
import { getErrorMessage } from '@/utils/errors'

const FILE_RE = /^sinfo:\/\/file\/([0-9a-f-]{36})$/
const TTL = 50 * 60 * 1000
const cache = new Map<string, { promise: Promise<string>; at: number }>()

// sinfo://file/<id> -> тимчасове підписане посилання (перевірка доступу на сервері)
export function resolveFileUrl(url: string): Promise<string> {
  const m = FILE_RE.exec(url)
  if (!m) return Promise.resolve(url)
  const id = m[1]
  const hit = cache.get(id)
  if (hit && Date.now() - hit.at < TTL) return hit.promise

  const promise = api
    .post<{ url: string }>(`/knowledge/files/${id}/link`)
    .then((r) => `${api.defaults.baseURL ?? ''}${r.data.url}`)
    .catch((err) => {
      cache.delete(id)
      throw err
    })
  cache.set(id, { promise, at: Date.now() })
  return promise
}

export async function uploadFile(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  try {
    const r = await api.post<{ url: string }>('/knowledge/files', form)
    return r.data.url
  } catch (err) {
    window.alert(getErrorMessage(err, 'Не вдалося завантажити файл'))
    throw err
  }
}