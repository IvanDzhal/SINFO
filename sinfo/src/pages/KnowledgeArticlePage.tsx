import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Clock, Eye } from 'lucide-react'
import clsx from 'clsx'
import { api } from '@/services/api'
import { useFetch } from '@/hooks/useFetch'
import { useThemeStore } from '@/store/useThemeStore'
import RichContent from '@/components/RichContent'

type ItemType = 'instruction' | 'material' | 'news'

interface Article {
  id: string
  type: ItemType
  title: string
  description: string
  content: unknown
  version: number
  isRequired: boolean
  viewsCount: number
  readingTimeMinutes: number
  updatedAt: string
  author: { firstName: string; lastName: string }
  category: { id: string; name: string; icon: string | null; parent: { name: string } | null } | null
  isRead: boolean
  readToken: string
}

interface Similar {
  id: string
  title: string
  readingTimeMinutes: number
}

interface Block {
  type?: string
  content?: unknown
  children?: Block[]
}

const BACK: Record<ItemType, [string, string]> = {
  instruction: ['/instructions', 'Інструкції'],
  material: ['/materials', 'Робочі матеріали'],
  news: ['/', 'Головна'],
}

function textOf(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content
    .map((c: { text?: string; content?: unknown }) =>
      typeof c.text === 'string' ? c.text : textOf(c.content),
    )
    .join('')
}

function collectHeadings(blocks: unknown) {
  const out: { title: string; index: number }[] = []
  if (!Array.isArray(blocks)) return out
  let index = 0
  const walk = (list: Block[]) =>
    list.forEach((b) => {
      if (b.type === 'heading') {
        out.push({ title: textOf(b.content).trim(), index })
        index += 1
      }
      if (b.children) walk(b.children)
    })
  walk(blocks as Block[])
  return out.filter((h) => h.title)
}

export default function KnowledgeArticlePage() {
  const { id } = useParams()
  const theme = useThemeStore((s) => s.theme)
  const [article, setArticle] = useState<Article | null>(null)
  const [error, setError] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)
  const similar = useFetch<Similar>(`/knowledge/items/${id}/similar`)

  useEffect(() => {
    setArticle(null)
    setError('')
    window.scrollTo({ top: 0 })
    api
      .get<Article>(`/knowledge/items/${id}`)
      .then((r) => setArticle(r.data))
      .catch(() => setError('Матеріал не знайдено або у вас немає доступу'))
  }, [id])

  // «Прочитано» після 10 секунд, поки вкладка активна
  useEffect(() => {
    if (!article || article.isRead) return
    let seconds = 0
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      seconds += 1
      if (seconds >= 10) {
        clearInterval(timer)
        api
          .post(`/knowledge/items/${article.id}/read`, { token: article.readToken })
          .then(() =>
            setArticle((a) => (a && a.id === article.id ? { ...a, isRead: true } : a)),
          )
          .catch(() => {})
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [article?.id])

  const toc = useMemo(() => collectHeadings(article?.content), [article])

  function scrollTo(index: number) {
    const els = contentRef.current?.querySelectorAll<HTMLElement>('[data-content-type="heading"]')
    const el = els?.[index]
    if (!el) return
    el.style.scrollMarginTop = '80px'
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (error) return <p className="text-danger">{error}</p>
  if (!article) return <p className="text-muted">Завантаження...</p>

  const [backTo, backLabel] = BACK[article.type]
  const categoryName = article.category
    ? article.category.parent
      ? `${article.category.parent.name} · ${article.category.name}`
      : article.category.name
    : null

  return (
    <div>
      <Link
        to={backTo}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft size={16} /> {backLabel}
      </Link>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <article className="rounded-2xl border border-border bg-surface p-5 sm:p-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {categoryName && (
              <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-muted">
                {categoryName}
              </span>
            )}
            {article.isRequired && (
              <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
                Обов'язково до ознайомлення
              </span>
            )}
            <span
              className={clsx(
                'rounded-full px-2.5 py-0.5 text-xs font-medium',
                article.isRead ? 'bg-success-soft text-success' : 'bg-surface-2 text-muted',
              )}
            >
              {article.isRead ? 'Прочитано' : 'Не прочитано'}
            </span>
          </div>

          <h1 className="text-2xl font-semibold">{article.title}</h1>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span>
              {article.author.firstName} {article.author.lastName}
            </span>
            <span>Оновлено {new Date(article.updatedAt).toLocaleDateString('uk-UA')}</span>
            <span>Версія {article.version}</span>
            <span className="inline-flex items-center gap-1">
              <Eye size={14} /> {article.viewsCount}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock size={14} /> {article.readingTimeMinutes} хв
            </span>
          </div>

          {article.description && <p className="mt-4 text-muted">{article.description}</p>}

          <hr className="my-5 border-border" />

          <div ref={contentRef}>
            <RichContent key={article.id} content={article.content} theme={theme} />
          </div>
        </article>

        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          {toc.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface p-4">
              <p className="mb-2 text-xs font-medium uppercase text-muted">На цій сторінці</p>
              <ol className="space-y-1.5 text-sm">
                {toc.map((h, n) => (
                  <li key={h.index}>
                    <button
                      onClick={() => scrollTo(h.index)}
                      className="text-left text-ink hover:text-accent"
                    >
                      {n + 1}. {h.title}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-surface p-4 text-sm">
            <div className="flex justify-between py-1">
              <span className="text-muted">Категорія</span>
              <span className="text-right">{categoryName ?? '—'}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted">Версія</span>
              <span>{article.version}</span>
            </div>
          </div>

          {similar.data.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface p-4">
              <p className="mb-2 text-xs font-medium uppercase text-muted">
                {article.type === 'instruction' ? 'Схожі інструкції' : 'Схожі матеріали'}
              </p>
              <div className="space-y-2 text-sm">
                {similar.data.map((s) => (
                  <Link key={s.id} to={`/knowledge/${s.id}`} className="block hover:text-accent">
                    <p>{s.title}</p>
                    <p className="text-xs text-muted">{s.readingTimeMinutes} хв</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}