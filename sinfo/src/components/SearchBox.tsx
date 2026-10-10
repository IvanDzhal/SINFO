import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Search } from 'lucide-react'
import { api } from '@/services/api'

interface Result {
  id: string
  type: 'instruction' | 'material' | 'news'
  title: string
  description: string
  category: { name: string } | null
}

const TYPE_LABEL = { instruction: 'Інструкція', material: 'Матеріал', news: 'Новина' }

export default function SearchBox() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Result[] | null>(null)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setResults(null)
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      api
        .get('/knowledge/items/search', { params: { q: term } })
        .then((r) => {
          if (cancelled) return
          setResults(r.data)
          setOpen(true)
        })
        .catch(() => !cancelled && setResults([]))
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [q])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  useEffect(() => {
    setOpen(false)
    setQ('')
  }, [pathname])

  return (
    <div ref={box} className="relative mx-3 min-w-0 max-w-md flex-1">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results && setOpen(true)}
        placeholder={pathname.startsWith('/materials') ? 'Пошук матеріалів…' : 'Пошук інструкцій…'}
        className="w-full rounded-xl border border-border bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-accent"
      />
      {open && results && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
          {results.length === 0 && (
            <p className="px-4 py-3 text-sm text-muted">Нічого не знайдено</p>
          )}
          {results.map((r) => (
            <Link
              key={r.id}
              to={`/knowledge/${r.id}`}
              className="block border-t border-border px-4 py-2.5 first:border-t-0 hover:bg-surface-2"
            >
              <p className="truncate text-sm font-medium">{r.title}</p>
              <p className="truncate text-xs text-muted">
                {TYPE_LABEL[r.type]}
                {r.category && ` · ${r.category.name}`}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}