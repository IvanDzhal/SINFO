import { useState } from 'react'
import { Download } from 'lucide-react'
import { api } from '@/services/api'
import { getErrorMessage } from '@/utils/errors'

// Завантажує .xlsx з бекенду (потрібен токен, тому не звичайне посилання)
export default function ExportButton({
  url,
  params,
  label = 'Excel',
}: {
  url: string
  params?: Record<string, string | undefined>
  label?: string
}) {
  const [busy, setBusy] = useState(false)

  async function download() {
    setBusy(true)
    try {
      const clean = Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v))
      const r = await api.get(url, { params: clean, responseType: 'blob' })
      const header = String(r.headers['content-disposition'] ?? '')
      const m = /filename\*=UTF-8''([^;]+)/i.exec(header)
      const name = m ? decodeURIComponent(m[1]) : 'export.xlsx'
      const link = document.createElement('a')
      link.href = URL.createObjectURL(r.data)
      link.download = name
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(link.href), 1000)
    } catch (err) {
      window.alert(getErrorMessage(err, 'Не вдалося сформувати файл'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={download}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-2 disabled:opacity-50"
    >
      <Download size={14} /> {busy ? 'Формую…' : label}
    </button>
  )
}
