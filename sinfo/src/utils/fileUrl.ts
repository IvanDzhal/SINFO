import { api } from '@/services/api'
import { getErrorMessage } from '@/utils/errors'

const FILE_RE = /^sinfo:\/\/file\/([0-9a-f-]{36})$/
const ID_RE = /sinfo:\/\/file\/([0-9a-f-]{36})/g
const TTL = 50 * 60 * 1000
const cache = new Map<string, { promise: Promise<string>; at: number }>()

const full = (path: string) => `${api.defaults.baseURL ?? ''}${path}`

// Усі фото статті одним запитом: решта викликів resolveFileUrl бере готовий результат з кешу
export function prefetchFileUrls(content: unknown) {
  if (!content) return
  const ids = [...new Set([...JSON.stringify(content).matchAll(ID_RE)].map((m) => m[1]))].filter(
    (id) => {
      const hit = cache.get(id)
      return !hit || Date.now() - hit.at >= TTL
    },
  )
  if (ids.length === 0) return

  const batch = api
    .post<{ urls: Record<string, string> }>('/knowledge/files/links', { ids })
    .then((r) => r.data.urls)
  const at = Date.now()
  for (const id of ids) {
    const promise = batch.then((urls) => {
      if (!urls[id]) throw new Error('no access')
      return full(urls[id])
    })
    promise.catch(() => cache.delete(id))
    cache.set(id, { promise, at })
  }
}

// sinfo://file/<id> -> тимчасове підписане посилання (перевірка доступу на сервері)
export function resolveFileUrl(url: string): Promise<string> {
  const m = FILE_RE.exec(url)
  if (!m) return Promise.resolve(url)
  const id = m[1]
  const hit = cache.get(id)
  if (hit && Date.now() - hit.at < TTL) return hit.promise

  const promise = api
    .post<{ url: string }>(`/knowledge/files/${id}/link`)
    .then((r) => full(r.data.url))
    .catch((err) => {
      cache.delete(id)
      throw err
    })
  cache.set(id, { promise, at: Date.now() })
  return promise
}

const MAX_SIDE = 1920
const SKIP_BELOW = 300 * 1024

// Фото з телефона важать 3-8 МБ і довго вантажаться. Зменшуємо до 1920 px перед завантаженням:
// на екрані різниці немає, а файл у 5-10 разів легший.
async function shrink(file: File): Promise<File> {
  const type = file.type
  if (type !== 'image/jpeg' && type !== 'image/png') return file
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size < SKIP_BELOW) {
      bitmap.close()
      return file
    }
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    if (type === 'image/jpeg') {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, type, type === 'image/jpeg' ? 0.85 : undefined),
    )
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name, { type, lastModified: Date.now() })
  } catch {
    return file
  }
}

export async function uploadFile(original: File): Promise<string> {
  const file = await shrink(original)
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
