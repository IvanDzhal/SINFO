import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, Folder } from 'lucide-react'
import clsx from 'clsx'
import { useFetch } from '@/hooks/useFetch'

interface SubCat {
  id: string
  name: string
  count: number
}

interface Cat extends SubCat {
  children?: SubCat[]
}

export default function SidebarCategories({ onNavigate }: { onNavigate: () => void }) {
  const { pathname, search } = useLocation()
  const isMaterials = pathname.startsWith('/materials')
  const base = isMaterials ? '/materials' : '/instructions'
  const { data, reload } = useFetch<Cat>(
    `/knowledge/items/category-counts?type=${isMaterials ? 'material' : 'instruction'}`,
  )

  // оновлюємо лічильники при переході між сторінками
  useEffect(() => {
    reload()
  }, [pathname])

  const params = new URLSearchParams(search)
  const active = pathname === base ? params.get('category') : null
  const activeSub = pathname === base ? params.get('sub') : null
  if (data.length === 0) return null

  return (
    <div className="mt-4">
      <p className="mb-1 px-3 text-xs font-medium uppercase text-muted">Категорії</p>
      {data.map((c) => {
        const subs = c.children ?? []
        const expanded = active === c.id && subs.length > 0
        return (
          <div key={c.id}>
            <Link
              to={`${base}?category=${c.id}`}
              onClick={onNavigate}
              aria-expanded={subs.length > 0 ? expanded : undefined}
              className={clsx(
                'flex items-center gap-3 rounded-xl px-3 py-2 text-sm',
                active === c.id && !activeSub
                  ? 'bg-accent-soft font-medium text-accent'
                  : active === c.id
                    ? 'font-medium text-accent hover:bg-surface-2'
                    : 'text-ink hover:bg-surface-2',
              )}
            >
              <Folder size={16} />
              <span className="flex-1 truncate">{c.name}</span>
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">{c.count}</span>
              {subs.length > 0 && (
                <ChevronDown
                  size={14}
                  className={clsx('shrink-0 text-muted transition-transform', expanded && 'rotate-180')}
                />
              )}
            </Link>
            {expanded && (
              <div className="ml-5 mt-0.5 space-y-0.5 border-l border-border pl-2">
                {subs.map((s) => (
                  <Link
                    key={s.id}
                    to={`${base}?category=${c.id}&sub=${s.id}`}
                    onClick={onNavigate}
                    className={clsx(
                      'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm',
                      activeSub === s.id
                        ? 'bg-accent-soft font-medium text-accent'
                        : 'text-muted hover:bg-surface-2 hover:text-ink',
                    )}
                  >
                    <span className="flex-1 truncate">{s.name}</span>
                    <span className="text-xs">{s.count}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
