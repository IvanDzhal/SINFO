import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, Folder } from 'lucide-react'
import clsx from 'clsx'
import { useFetch } from '@/hooks/useFetch'
import { categorySlug, resolveCategoryId } from '@/utils/categorySlug'

interface SubCat {
  id: string
  name: string
  count: number
}

interface Cat extends SubCat {
  children?: SubCat[]
}

const OPEN_KEY = 'sidebar.openCategories'

function loadOpen(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(OPEN_KEY) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export default function SidebarCategories({ onNavigate }: { onNavigate: () => void }) {
  const { pathname, search } = useLocation()
  // у сайдбарі лише категорії інструкцій, категорії робочих матеріалів сюди не потрапляють
  const base = '/instructions'
  const { data, reload } = useFetch<Cat>('/knowledge/items/category-counts?type=instruction')

  // відкриті категорії запам'ятовуємо: не згортаються при переході на статтю чи іншу сторінку
  const [open, setOpen] = useState<string[]>(loadOpen)
  const setOpenSaved = (next: string[]) => {
    setOpen(next)
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  // оновлюємо лічильники при переході між сторінками
  useEffect(() => {
    reload()
  }, [pathname])

  const params = new URLSearchParams(search)
  const active = pathname === base ? resolveCategoryId(params.get('category'), data) : null
  const activeSub =
    pathname === base && active
      ? resolveCategoryId(params.get('sub'), data.find((c) => c.id === active)?.children ?? [])
      : null

  useEffect(() => {
    if (active && !open.includes(active)) setOpenSaved([...open, active])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  if (data.length === 0) return null

  return (
    <div className="mt-4">
      <p className="mb-1 px-3 text-xs font-medium uppercase text-muted">Категорії</p>
      {data.map((c) => {
        const subs = c.children ?? []
        const expanded = open.includes(c.id) && subs.length > 0
        return (
          <div key={c.id}>
            <Link
              to={`${base}?category=${categorySlug(c.name)}`}
              onClick={() => {
                if (!open.includes(c.id)) setOpenSaved([...open, c.id])
                onNavigate()
              }}
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
                  onClick={(e) => {
                    // стрілка лише згортає/розгортає, без переходу
                    e.preventDefault()
                    e.stopPropagation()
                    setOpenSaved(expanded ? open.filter((id) => id !== c.id) : [...open, c.id])
                  }}
                  className={clsx('shrink-0 text-muted transition-transform', expanded && 'rotate-180')}
                />
              )}
            </Link>
            {expanded && (
              <div className="ml-5 mt-0.5 space-y-0.5 border-l border-border pl-2">
                {subs.map((s) => (
                  <Link
                    key={s.id}
                    to={`${base}?category=${categorySlug(c.name)}&sub=${categorySlug(s.name)}`}
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
