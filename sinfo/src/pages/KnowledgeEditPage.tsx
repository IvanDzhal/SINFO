import { Fragment, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import clsx from 'clsx'
import { api } from '@/services/api'
import Button from '@/components/Button'
import RichEditor from '@/components/RichEditor'
import { Select } from '@/components/Field'
import { useCan } from '@/hooks/useCan'
import { useThemeStore } from '@/store/useThemeStore'
import { getErrorMessage } from '@/utils/errors'

type ItemType = 'instruction' | 'material' | 'news'
type Status = 'draft' | 'published' | 'archived'
type Kind = 'GLOBAL' | 'REGION' | 'STORE' | 'ROLE'

interface Cat {
  id: string
  name: string
  parentId: string | null
}
interface Named {
  id: string
  name: string
}
interface Rule {
  kind: Kind
  targetId: string | null
}
interface Options {
  global: boolean
  regions: Named[]
  stores: (Named & { regionId: string })[]
  roles: Named[]
}
interface EditItem {
  id: string
  type: ItemType
  title: string
  description: string
  content: unknown
  categoryId: string | null
  status: Status
  version: number
  isRequired: boolean
  visibility: Rule[]
}

const TYPE_LABEL: Record<ItemType, string> = {
  instruction: 'Інструкція',
  material: 'Матеріал',
  news: 'Новина',
}
const STATUS_LABEL: Record<Status, string> = {
  draft: 'Чернетка',
  published: 'Опубліковано',
  archived: 'В архіві',
}
const BACK: Record<ItemType, string> = {
  instruction: '/instructions',
  material: '/materials',
  news: '/',
}

const inputClass =
  'w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent disabled:opacity-60'

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value]
}

function Pill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'rounded-full border px-3 py-1 text-sm',
        active ? 'border-accent bg-accent-soft text-accent' : 'border-border bg-surface-2',
      )}
    >
      {label}
    </button>
  )
}

export default function KnowledgeEditPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const can = useCan()
  const theme = useThemeStore((s) => s.theme)
  const isNew = !id

  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)

  const [cats, setCats] = useState<Cat[]>([])
  const [options, setOptions] = useState<Options | null>(null)

  const paramType = params.get('type')
  const [type, setType] = useState<ItemType>(
    paramType === 'material' || paramType === 'news' ? paramType : 'instruction',
  )
  const [status, setStatus] = useState<Status>('draft')
  const [version, setVersion] = useState(1)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [isRequired, setIsRequired] = useState(false)
  const [visAll, setVisAll] = useState(true)
  const [regionIds, setRegionIds] = useState<string[]>([])
  const [storeIds, setStoreIds] = useState<string[]>([])
  const [roleIds, setRoleIds] = useState<string[]>([])
  const [initialContent, setInitialContent] = useState<unknown>(undefined)
  const contentRef = useRef<unknown>(undefined)
  const contentDirty = useRef(false)

  const canVis = can('knowledge.manage_visibility')

  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    setDirty(false)
    contentRef.current = undefined
    contentDirty.current = false

    const jobs: Promise<unknown>[] = [
      api.get<Cat[]>('/knowledge/categories').then((r) => setCats(r.data)),
    ]
    if (canVis) {
      jobs.push(
        api.get<Options>('/knowledge/manage/options').then((r) => {
          setOptions(r.data)
          if (!r.data.global) setVisAll(false)
        }),
      )
    }
    if (id) {
      jobs.push(
        api.get<EditItem>(`/knowledge/manage/items/${id}`).then((r) => {
          const it = r.data
          setType(it.type)
          setStatus(it.status)
          setVersion(it.version)
          setTitle(it.title)
          setDescription(it.description)
          setCategoryId(it.categoryId ?? '')
          setIsRequired(it.isRequired)
          setInitialContent(it.content)
          const pick = (k: Kind) =>
            it.visibility.filter((x) => x.kind === k && x.targetId).map((x) => x.targetId as string)
          setVisAll(it.visibility.length === 0 || it.visibility.some((x) => x.kind === 'GLOBAL'))
          setRegionIds(pick('REGION'))
          setStoreIds(pick('STORE'))
          setRoleIds(pick('ROLE'))
        }),
      )
    }
    Promise.all(jobs)
      .then(() => !cancelled && setLoaded(true))
      .catch((err) => !cancelled && setError(getErrorMessage(err, 'Не вдалося завантажити')))
    return () => {
      cancelled = true
    }
  }, [id])

  function visibilityRules() {
    if (!canVis) return undefined
    if (visAll) return []
    return [
      ...regionIds.map((t) => ({ kind: 'REGION' as const, targetId: t })),
      ...storeIds.map((t) => ({ kind: 'STORE' as const, targetId: t })),
      ...roleIds.map((t) => ({ kind: 'ROLE' as const, targetId: t })),
    ]
  }

  async function save(): Promise<string | null> {
    setError('')
    setMessage('')
    if (title.trim().length < 2) {
      setError('Введіть назву матеріалу')
      return null
    }
    setBusy(true)
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim(),
        categoryId: categoryId || null,
        isRequired,
      }
      const vis = visibilityRules()
      if (vis) body.visibility = vis
      if (isNew || contentDirty.current) body.content = contentRef.current
      if (isNew) {
        const r = await api.post<{ id: string }>('/knowledge/manage/items', { ...body, type })
        return r.data.id
      }
      const r = await api.patch<{ version: number }>(`/knowledge/manage/items/${id}`, body)
      setVersion(r.data.version)
      setDirty(false)
      contentDirty.current = false
      return id ?? null
    } catch (err) {
      setError(getErrorMessage(err, 'Не вдалося зберегти'))
      return null
    } finally {
      setBusy(false)
    }
  }

  async function onSave() {
    const savedId = await save()
    if (!savedId) return
    if (isNew) navigate(`/knowledge/${savedId}/edit`, { replace: true })
    else setMessage(status === 'published' ? 'Зміни збережено' : 'Чернетку збережено')
  }

  async function onPublish() {
    const savedId = await save()
    if (!savedId) return
    setBusy(true)
    try {
      await api.post(`/knowledge/manage/items/${savedId}/publish`)
      navigate(`/knowledge/${savedId}`)
    } catch (err) {
      setError(getErrorMessage(err, 'Не вдалося опублікувати'))
      if (isNew) navigate(`/knowledge/${savedId}/edit`, { replace: true })
    } finally {
      setBusy(false)
    }
  }

  async function run(action: () => Promise<unknown>, after: () => void) {
    setError('')
    setBusy(true)
    try {
      await action()
      after()
    } catch (err) {
      setError(getErrorMessage(err, 'Не вдалося виконати дію'))
    } finally {
      setBusy(false)
    }
  }

  function archive() {
    if (!window.confirm('Перенести в архів? Матеріал зникне зі списків для користувачів.')) return
    run(
      () => api.post(`/knowledge/manage/items/${id}/archive`),
      () => navigate(BACK[type]),
    )
  }

  function restore() {
    run(
      () => api.post(`/knowledge/manage/items/${id}/restore`),
      () => {
        setStatus('draft')
        setMessage('Повернуто в чернетки')
      },
    )
  }

  function remove() {
    if (!window.confirm('Видалити чернетку назавжди?')) return
    run(
      () => api.delete(`/knowledge/manage/items/${id}`),
      () => navigate(BACK[type]),
    )
  }

  if (!loaded) {
    return error ? <p className="text-danger">{error}</p> : <p className="text-muted">Завантаження...</p>
  }

  const published = status === 'published'
  const archived = status === 'archived'
  const backTo = published && id ? `/knowledge/${id}` : BACK[type]

  return (
    <div>
      <Link to={backTo} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} /> Назад
      </Link>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">{isNew ? 'Новий матеріал' : 'Редагування'}</h2>
        <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-muted">
          {TYPE_LABEL[type]}
        </span>
        {!isNew && (
          <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
            {STATUS_LABEL[status]}
            {published && ` · версія ${version}`}
          </span>
        )}
      </div>

      {archived && (
        <p className="mb-4 rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">
          Матеріал в архіві. Щоб редагувати, поверніть його в чернетки.
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
          <input
            className="mb-3 w-full bg-transparent text-2xl font-semibold text-ink outline-none placeholder:text-muted"
            placeholder="Назва"
            value={title}
            disabled={archived}
            onChange={(e) => {
              setTitle(e.target.value)
              setDirty(true)
            }}
          />
          <textarea
            className={`${inputClass} mb-4 resize-y`}
            rows={2}
            placeholder="Короткий опис (показується у списку)"
            value={description}
            disabled={archived}
            onChange={(e) => {
              setDescription(e.target.value)
              setDirty(true)
            }}
          />
          <div className="min-h-[320px] rounded-xl border border-border py-2">
            <RichEditor
              key={id ?? 'new'}
              initialContent={initialContent}
              theme={theme}
              editable={!archived}
              onChange={(blocks) => {
                contentRef.current = blocks
                contentDirty.current = true
                setDirty(true)
              }}
            />
          </div>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <Select
              label="Категорія"
              value={categoryId}
              disabled={archived}
              onChange={(e) => {
                setCategoryId(e.target.value)
                setDirty(true)
              }}
            >
              <option value="">— без категорії —</option>
              {cats
                .filter((c) => !c.parentId)
                .map((root) => (
                  <Fragment key={root.id}>
                    <option value={root.id}>{root.name}</option>
                    {cats
                      .filter((c) => c.parentId === root.id)
                      .map((k) => (
                        <option key={k.id} value={k.id}>{`— ${k.name}`}</option>
                      ))}
                  </Fragment>
                ))}
            </Select>

            <label className="mt-1 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={isRequired}
                disabled={archived}
                onChange={(e) => {
                  setIsRequired(e.target.checked)
                  setDirty(true)
                }}
              />
              <span>Обов'язково до ознайомлення</span>
            </label>
          </div>

          {canVis && options && (
            <div className="rounded-2xl border border-border bg-surface p-4">
              <p className="mb-2 text-sm font-medium">Кому показувати</p>
              <div className="mb-3 flex gap-2">
                {options.global && (
                  <Pill
                    label="Всім"
                    active={visAll}
                    onClick={() => {
                      setVisAll(true)
                      setDirty(true)
                    }}
                  />
                )}
                <Pill
                  label="Вибраним"
                  active={!visAll}
                  onClick={() => {
                    setVisAll(false)
                    setDirty(true)
                  }}
                />
              </div>

              {!visAll && (
                <div className="space-y-3">
                  {options.regions.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs text-muted">Області</p>
                      <div className="flex flex-wrap gap-2">
                        {options.regions.map((r) => (
                          <Pill
                            key={r.id}
                            label={r.name}
                            active={regionIds.includes(r.id)}
                            onClick={() => {
                              setRegionIds((l) => toggle(l, r.id))
                              setDirty(true)
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {options.stores.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs text-muted">Магазини</p>
                      <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                        {options.stores.map((s) => (
                          <Pill
                            key={s.id}
                            label={s.name}
                            active={storeIds.includes(s.id)}
                            onClick={() => {
                              setStoreIds((l) => toggle(l, s.id))
                              setDirty(true)
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {options.roles.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs text-muted">Ролі</p>
                      <div className="flex flex-wrap gap-2">
                        {options.roles.map((r) => (
                          <Pill
                            key={r.id}
                            label={r.name}
                            active={roleIds.includes(r.id)}
                            onClick={() => {
                              setRoleIds((l) => toggle(l, r.id))
                              setDirty(true)
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {published && (
            <p className="px-1 text-xs text-muted">
              Збереження змін у тексті створює нову версію матеріалу.
            </p>
          )}
        </aside>
      </div>

      <div className="sticky bottom-0 mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-border bg-bg py-3">
        {message && <span className="text-sm text-success">{message}</span>}
        {error && <span className="text-sm text-danger">{error}</span>}

        {!isNew && status === 'draft' && can('knowledge.delete') && (
          <Button variant="ghost" onClick={remove} disabled={busy}>
            <span className="text-danger">Видалити</span>
          </Button>
        )}
        {published && can('knowledge.archive') && (
          <Button variant="ghost" onClick={archive} disabled={busy}>
            В архів
          </Button>
        )}
        {archived ? (
          can('knowledge.archive') && (
            <Button onClick={restore} disabled={busy}>
              Відновити в чернетки
            </Button>
          )
        ) : (
          <>
            <Button
              variant="ghost"
              onClick={onSave}
              disabled={busy || (!isNew && !dirty)}
            >
              {published ? 'Зберегти зміни' : 'Зберегти чернетку'}
            </Button>
            {!published && can('knowledge.publish') && (
              <Button onClick={onPublish} disabled={busy}>
                Опублікувати
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}