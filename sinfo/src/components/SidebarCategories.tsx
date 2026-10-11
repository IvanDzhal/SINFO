import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Folder } from 'lucide-react'
import clsx from 'clsx'
import { useFetch } from '@/hooks/useFetch'

interface Cat {
  id: string
  name: string
  count: number
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

  const active = pathname === base ? new URLSearchParams(search).get('category') : null
  if (data.length === 0) return null

  return (
    <div className="mt-4">
      <p className="mb-1 px-3 text-xs font-medium uppercase text-muted">Категорії</p>
      {data.map((c) => (
        <Link
          key={c.id}
          to={`${base}?category=${c.id}`}
          onClick={onNavigate}
          className={clsx(
            'flex items-center gap-3 rounded-xl px-3 py-2 text-sm',
            active === c.id ? 'bg-accent-soft font-medium text-accent' : 'text-ink hover:bg-surface-2',
          )}
        >
          <Folder size={16} />
          <span className="flex-1 truncate">{c.name}</span>
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">{c.count}</span>
        </Link>
      ))}
    </div>
  )
}