import { Fragment, useState } from 'react'
import { ArrowDown, ArrowUp, Plus } from 'lucide-react'
import Button from '@/components/Button'
import Modal from '@/components/Modal'
import { Input } from '@/components/Field'
import { useFetch } from '@/hooks/useFetch'
import { useCan } from '@/hooks/useCan'
import { api } from '@/services/api'
import { getErrorMessage } from '@/utils/errors'

interface Category {
  id: string
  name: string
  icon: string | null
  parentId: string | null
  archivedAt: string | null
}

type ModalState =
  | { mode: 'create'; parent: Category | null }
  | { mode: 'edit'; category: Category }
  | null

function CategoryModal({
  state,
  onClose,
  onSaved,
}: {
  state: NonNullable<ModalState>
  onClose: () => void
  onSaved: () => void
}) {
  const editing = state.mode === 'edit' ? state.category : null
  const parent = state.mode === 'create' ? state.parent : null
  const [name, setName] = useState(editing?.name ?? '')
  const [icon, setIcon] = useState(editing?.icon ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const title = editing
    ? 'Редагувати категорію'
    : parent
      ? `Нова підкатегорія в «${parent.name}»`
      : 'Нова категорія'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      if (editing) {
        await api.patch(`/knowledge/categories/${editing.id}`, {
          name: name.trim(),
          icon: icon.trim(),
        })
      } else {
        await api.post('/knowledge/categories', {
          name: name.trim(),
          icon: icon.trim() || undefined,
          parentId: parent?.id,
        })
      }
      onSaved()
    } catch (err) {
      setError(getErrorMessage(err, 'Не вдалося зберегти'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit}>
        <Input label="Назва" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input
          label="Іконка (emoji)"
          placeholder="наприклад 🛒"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
        />
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Скасувати
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Збереження...' : 'Зберегти'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default function CategoriesPage() {
  const { data, loading, error, reload } = useFetch<Category>('/knowledge/categories?archived=1')
  const can = useCan()
  const canManage = can('knowledge.manage_categories')
  const [modal, setModal] = useState<ModalState>(null)

  const roots = data.filter((c) => !c.parentId)
  const kids = (id: string) => data.filter((c) => c.parentId === id)

  async function act(fn: () => Promise<unknown>) {
    try {
      await fn()
      reload()
    } catch (err) {
      window.alert(getErrorMessage(err, 'Не вдалося виконати дію'))
    }
  }

  const move = (c: Category, direction: 'up' | 'down') =>
    act(() => api.patch(`/knowledge/categories/${c.id}/move`, { direction }))

  const restore = (c: Category) => act(() => api.patch(`/knowledge/categories/${c.id}/restore`))

  function archive(c: Category) {
    const extra = c.parentId ? '' : ' Підкатегорії теж буде архівовано.'
    if (!window.confirm(`Архівувати «${c.name}»?${extra}`)) return
    act(() => api.delete(`/knowledge/categories/${c.id}`))
  }

  function renderRow(c: Category, list: Category[], sub = false) {
    const active = list.filter((x) => !x.archivedAt)
    const idx = active.findIndex((x) => x.id === c.id)
    const archived = !!c.archivedAt
    return (
      <div
        key={c.id}
        className={`flex flex-wrap items-center justify-between gap-2 border-t border-border py-2.5 pr-4 first:border-t-0 ${
          sub ? 'pl-12' : 'pl-4'
        } ${archived ? 'opacity-60' : ''}`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="w-6 text-center">{c.icon ?? (sub ? '' : '📁')}</span>
          <span className={sub ? 'text-sm' : 'font-medium'}>{c.name}</span>
          {archived && (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">Архів</span>
          )}
        </div>
        {canManage && (
          <div className="flex items-center gap-3 text-sm">
            {archived ? (
              <button className="text-accent hover:underline" onClick={() => restore(c)}>
                Відновити
              </button>
            ) : (
              <>
                <button
                  aria-label="Вгору"
                  disabled={idx <= 0}
                  onClick={() => move(c, 'up')}
                  className="text-muted hover:text-ink disabled:opacity-30"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  aria-label="Вниз"
                  disabled={idx === active.length - 1}
                  onClick={() => move(c, 'down')}
                  className="text-muted hover:text-ink disabled:opacity-30"
                >
                  <ArrowDown size={16} />
                </button>
                {!sub && (
                  <button
                    className="text-accent hover:underline"
                    onClick={() => setModal({ mode: 'create', parent: c })}
                  >
                    + Підкатегорія
                  </button>
                )}
                <button
                  className="text-accent hover:underline"
                  onClick={() => setModal({ mode: 'edit', category: c })}
                >
                  Редагувати
                </button>
                <button className="text-danger hover:underline" onClick={() => archive(c)}>
                  Архівувати
                </button>
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Категорії бази знань</h2>
        {canManage && (
          <Button onClick={() => setModal({ mode: 'create', parent: null })}>
            <Plus size={16} /> Створити
          </Button>
        )}
      </div>

      {loading && <p className="text-muted">Завантаження...</p>}
      {error && <p className="text-danger">{error}</p>}
      {!loading && !error && (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          {roots.length === 0 && (
            <p className="px-4 py-6 text-center text-muted">Поки нічого немає</p>
          )}
          {roots.map((c) => (
            <Fragment key={c.id}>
              {renderRow(c, roots)}
              {kids(c.id).map((k) => renderRow(k, kids(c.id), true))}
            </Fragment>
          ))}
        </div>
      )}

      {modal && (
        <CategoryModal
          state={modal}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            reload()
          }}
        />
      )}
    </div>
  )
}