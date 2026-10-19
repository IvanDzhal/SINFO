import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Clock, X } from 'lucide-react'
import { api } from '@/services/api'
import { usePageTitle } from '@/hooks/usePageTitle'

interface Result {
  id: string
  slug: string | null
  type: 'instruction' | 'material' | 'news'
  title: string
  description: string
  snippet: string
  category: { name: string } | null
  updatedAt: string
}

const TYPE_LABEL = { instruction: 'Інструкція', material: 'Матеріал', news: 'Новина' }
const RECENT_KEY = 'sinfo_recent_searches'

function loadRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function saveRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8)))
  } catch {
    /* ignore */
  }
}

// Виділяє слова запиту в тексті
function Marked({ text, words }: { text: string; words: string[] }) {
  if (!text || words.length === 0) return <>{text}</>
  const esc = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const parts = text.split(new RegExp(`(${esc.join('|')})`, 'gi'))
  return (
    <>
      {parts.map((p, i) =>
        words.some((w) => w.toLowerCase() === p.toLowerCase()) ? (
          <mark key={i} className="rounded bg-accent-soft px-0.5 text-ink">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}

export default function SearchPage() {
  usePageTitle('Пошук')
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const type = params.get('type') ?? ''
  const [input, setInput] = useState(q)
  const [results, setResults] = useState<Result[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [recent, setRecent] = useState<string[]>(loadRecent)

  useEffect(() => setInput(q), [q])

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setResults(null)
      return
    }
    let cancelled = false
    setResults(null)
    setFailed(false)
    api
      .get<Result[]>('/knowledge/items/search/full', { params: { q: term, type: type || undefined } })
      .then((r) => {
        if (cancelled) return
        setResults(r.data)
        const next = [term, ...loadRecent().filter((x) => x.toLowerCase() !== term.toLowerCase())]
        saveRecent(next)
        setRecent(next.slice(0, 8))
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [q, type])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const next = new URLSearchParams()
    if (input.trim()) next.set('q', input.trim())
    if (type) next.set('type', type)
    setParams(next)
  }

  function setType(t: string) {
    const next = new URLSearchParams(params)
    if (t) next.set('type', t)
    else next.delete('type')
    setParams(next)
  }

  const words = q.trim().split(/\s+/).filter((w) => w.length >= 2)

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-4 text-2xl font-semibold">Пошук</h2>
      <form onSubmit={submit} className="mb-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
          placeholder="Що шукаємо?"
          className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white">Знайти</button>
      </form>

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          ['', 'Усе'],
          ['instruction', 'Інструкції'],
          ['material', 'Матеріали'],
        ].map(([v, label]) => (
          <button
            key={v}
            onClick={() => setType(v)}
            className={`rounded-full border px-3 py-1 text-sm ${
              type === v ? 'border-accent bg-accent-soft text-accent' : 'border-border text-muted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {q.trim().length < 2 && recent.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-muted">Останні запити</p>
            <button
              className="text-xs text-muted hover:text-ink"
              onClick={() => {
                saveRecent([])
                setRecent([])
              }}
            >
              Очистити
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recent.map((r) => (
              <span
                key={r}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-surface py-1 pl-3 pr-1.5 text-sm"
              >
                <button onClick={() => setParams({ q: r })}>{r}</button>
                <button
                  aria-label="Прибрати"
                  onClick={() => {
                    const next = recent.filter((x) => x !== r)
                    saveRecent(next)
                    setRecent(next)
                  }}
                >
                  <X size={14} className="text-muted" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {failed && <p className="text-danger">Не вдалося виконати пошук</p>}
      {q.trim().length >= 2 && !results && !failed && <p className="text-muted">Пошук...</p>}
      {results && results.length === 0 && <p className="text-muted">Нічого не знайдено за запитом «{q}».</p>}
      {results && results.length > 0 && (
        <p className="mb-2 text-sm text-muted">Знайдено: {results.length}</p>
      )}
      <div className="space-y-3">
        {results?.map((r) => (
          <Link
            key={r.id}
            to={`/knowledge/${r.slug ?? r.id}`}
            className="block rounded-2xl border border-border bg-surface p-4 hover:bg-surface-2"
          >
            <p className="font-medium">
              <Marked text={r.title} words={words} />
            </p>
            <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
              {TYPE_LABEL[r.type]}
              {r.category && <span>· {r.category.name}</span>}
              <span className="inline-flex items-center gap-1">
                <Clock size={12} /> {new Date(r.updatedAt).toLocaleDateString('uk-UA')}
              </span>
            </p>
            {r.description && (
              <p className="mt-1.5 text-sm text-muted">
                <Marked text={r.description} words={words} />
              </p>
            )}
            {r.snippet && (
              <p className="mt-1 text-sm text-muted">
                <Marked text={r.snippet} words={words} />
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
