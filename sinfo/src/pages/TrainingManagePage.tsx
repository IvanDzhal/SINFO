import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  FileText,
  History,
  Pencil,
  PlayCircle,
  Plus,
  Trash2,
  Type,
} from 'lucide-react'
import clsx from 'clsx'
import { api } from '@/services/api'
import { useCan } from '@/hooks/useCan'
import { useThemeStore } from '@/store/useThemeStore'
import { getErrorMessage } from '@/utils/errors'
import Button from '@/components/Button'
import Modal from '@/components/Modal'
import RichEditor from '@/components/RichEditor'
import { Input, Select } from '@/components/Field'

type Kind = 'text' | 'video' | 'pdf'

interface LessonRow {
  id: string
  kind: Kind
  title: string
  version: number
}

interface StageRow {
  id: string
  title: string
  description: string
  status: 'draft' | 'published' | 'archived'
  testId: string | null
  test: { id: string; title: string } | null
  lessons: LessonRow[]
}

interface TestOption {
  id: string
  title: string
}

const KIND_LABEL: Record<Kind, string> = { text: 'Текст', video: 'Відео (YouTube)', pdf: 'PDF' }
const KIND_ICON = { text: Type, video: PlayCircle, pdf: FileText }
const STATUS_LABEL = { draft: 'Чернетка', published: 'Опубліковано', archived: 'Архів' }

export default function TrainingManagePage() {
  const can = useCan()
  const [tab, setTab] = useState<'structure' | 'progress'>(
    can('training.manage') ? 'structure' : 'progress',
  )

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/training" className="mb-4 inline-flex items-center gap-1 text-sm text-muted">
        <ArrowLeft size={16} /> До навчання
      </Link>
      <h1 className="mb-4 text-2xl font-semibold">Керування навчанням</h1>

      <div className="mb-5 flex gap-2">
        {can('training.manage') && (
          <TabButton active={tab === 'structure'} onClick={() => setTab('structure')}>
            Структура
          </TabButton>
        )}
        {can('training.view_analytics') && (
          <TabButton active={tab === 'progress'} onClick={() => setTab('progress')}>
            Прогрес співробітників
          </TabButton>
        )}
      </div>

      {tab === 'structure' ? <Structure /> : <Progress />}
    </div>
  )
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'rounded-xl px-4 py-2 text-sm',
        active ? 'bg-accent text-white' : 'border border-border bg-surface hover:bg-surface-2',
      )}
    >
      {children}
    </button>
  )
}

// ───────── Структура ─────────

function Structure() {
  const [stages, setStages] = useState<StageRow[] | null>(null)
  const [tests, setTests] = useState<TestOption[]>([])
  const [error, setError] = useState('')
  const [stageModal, setStageModal] = useState(false)
  const [lessonModal, setLessonModal] = useState<{ stageId: string; lessonId: string | null } | null>(null)
  const [versions, setVersions] = useState<string | null>(null)

  const load = useCallback(() => {
    api
      .get<StageRow[]>('/training/manage/stages')
      .then((r) => setStages(r.data))
      .catch(() => setError('Не вдалося завантажити структуру'))
    api.get<TestOption[]>('/training/manage/tests').then((r) => setTests(r.data))
  }, [])
  useEffect(load, [load])

  async function run(fn: () => Promise<unknown>) {
    setError('')
    try {
      await fn()
      load()
    } catch (e) {
      setError(getErrorMessage(e, 'Дію не виконано'))
    }
  }

  function move<T extends { id: string }>(list: T[], i: number, d: -1 | 1) {
    const ids = list.map((x) => x.id)
    const j = i + d
    if (j < 0 || j >= ids.length) return null
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    return ids
  }

  if (!stages) return <p className="text-muted">{error || 'Завантаження…'}</p>

  return (
    <div className="space-y-4">
      {error && <p className="text-danger">{error}</p>}
      <p className="text-sm text-muted">
        Етапи проходять послідовно. Тест створюється в розділі «Тестування» й має бути
        опублікований та призначений співробітникам.
      </p>

      {stages.map((s, i) => (
        <section key={s.id} className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold">
                {i + 1}. {s.title}
              </h2>
              <span className="text-xs text-muted">{STATUS_LABEL[s.status]}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              <IconBtn
                label="Вгору"
                disabled={i === 0}
                onClick={() => {
                  const ids = move(stages, i, -1)
                  if (ids) run(() => api.patch('/training/manage/stages/reorder', { ids }))
                }}
              >
                <ArrowUp size={16} />
              </IconBtn>
              <IconBtn
                label="Вниз"
                disabled={i === stages.length - 1}
                onClick={() => {
                  const ids = move(stages, i, 1)
                  if (ids) run(() => api.patch('/training/manage/stages/reorder', { ids }))
                }}
              >
                <ArrowDown size={16} />
              </IconBtn>
              {s.status !== 'published' ? (
                <Button
                  variant="ghost"
                  onClick={() => run(() => api.post(`/training/manage/stages/${s.id}/publish`))}
                >
                  <CheckCircle2 size={16} /> Опублікувати
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => run(() => api.post(`/training/manage/stages/${s.id}/unpublish`))}
                >
                  Зняти з публікації
                </Button>
              )}
              {s.status !== 'archived' && (
                <IconBtn
                  label="Архівувати"
                  onClick={() => run(() => api.post(`/training/manage/stages/${s.id}/archive`))}
                >
                  <Archive size={16} />
                </IconBtn>
              )}
              <IconBtn
                label="Видалити"
                onClick={() => {
                  if (window.confirm('Видалити етап?'))
                    run(() => api.delete(`/training/manage/stages/${s.id}`))
                }}
              >
                <Trash2 size={16} />
              </IconBtn>
            </div>
          </div>

          <ul className="mt-3 space-y-1">
            {s.lessons.map((l, li) => {
              const Icon = KIND_ICON[l.kind]
              return (
                <li key={l.id} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
                  <Icon size={16} className="shrink-0 text-muted" />
                  <span className="flex-1">{l.title}</span>
                  <span className="text-xs text-muted">v{l.version}</span>
                  <IconBtn
                    label="Вгору"
                    disabled={li === 0}
                    onClick={() => {
                      const ids = move(s.lessons, li, -1)
                      if (ids) run(() => api.patch(`/training/manage/stages/${s.id}/lessons/reorder`, { ids }))
                    }}
                  >
                    <ArrowUp size={14} />
                  </IconBtn>
                  <IconBtn
                    label="Вниз"
                    disabled={li === s.lessons.length - 1}
                    onClick={() => {
                      const ids = move(s.lessons, li, 1)
                      if (ids) run(() => api.patch(`/training/manage/stages/${s.id}/lessons/reorder`, { ids }))
                    }}
                  >
                    <ArrowDown size={14} />
                  </IconBtn>
                  <IconBtn label="Версії" onClick={() => setVersions(l.id)}>
                    <History size={14} />
                  </IconBtn>
                  <IconBtn label="Редагувати" onClick={() => setLessonModal({ stageId: s.id, lessonId: l.id })}>
                    <Pencil size={14} />
                  </IconBtn>
                  <IconBtn
                    label="Архівувати"
                    onClick={() => {
                      if (window.confirm('Прибрати урок із етапу?'))
                        run(() => api.delete(`/training/manage/lessons/${l.id}`))
                    }}
                  >
                    <Trash2 size={14} />
                  </IconBtn>
                </li>
              )
            })}
          </ul>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <Button variant="ghost" onClick={() => setLessonModal({ stageId: s.id, lessonId: null })}>
              <Plus size={16} /> Урок
            </Button>
            <div className="min-w-56 flex-1">
              <Select
                label="Тест етапу"
                value={s.testId ?? ''}
                onChange={(e) =>
                  run(() =>
                    api.patch(`/training/manage/stages/${s.id}`, { testId: e.target.value || null }),
                  )
                }
              >
                <option value="">Без тесту</option>
                {s.test && !tests.some((t) => t.id === s.test!.id) && (
                  <option value={s.test.id}>{s.test.title}</option>
                )}
                {tests.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </section>
      ))}

      <Button onClick={() => setStageModal(true)}>
        <Plus size={16} /> Додати етап
      </Button>

      {stageModal && (
        <StageModal
          onClose={() => setStageModal(false)}
          onSaved={() => {
            setStageModal(false)
            load()
          }}
        />
      )}
      {lessonModal && (
        <LessonModal
          stageId={lessonModal.stageId}
          lessonId={lessonModal.lessonId}
          onClose={() => setLessonModal(null)}
          onSaved={() => {
            setLessonModal(null)
            load()
          }}
        />
      )}
      {versions && (
        <VersionsDialog
          lessonId={versions}
          onClose={() => setVersions(null)}
          onRestored={() => {
            setVersions(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function IconBtn({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  )
}

function StageModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  async function save() {
    try {
      await api.post('/training/manage/stages', { title, description })
      onSaved()
    } catch (e) {
      setError(getErrorMessage(e, 'Не вдалося створити етап'))
    }
  }

  return (
    <Modal title="Новий етап" onClose={onClose}>
      <Input label="Назва" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Input label="Опис" value={description} onChange={(e) => setDescription(e.target.value)} />
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      <Button onClick={save} disabled={title.trim().length < 2}>
        Створити
      </Button>
    </Modal>
  )
}

function LessonModal({
  stageId,
  lessonId,
  onClose,
  onSaved,
}: {
  stageId: string
  lessonId: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const theme = useThemeStore((s) => s.theme)
  const can = useCan()
  const [loading, setLoading] = useState(!!lessonId)
  const [kind, setKind] = useState<Kind>('text')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState<unknown>([])
  const [videoUrl, setVideoUrl] = useState('')
  const [fileId, setFileId] = useState('')
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!lessonId) return
    api
      .get(`/training/manage/lessons/${lessonId}`)
      .then((r) => {
        setKind(r.data.kind)
        setTitle(r.data.title)
        setContent(r.data.content ?? [])
        setVideoUrl(r.data.videoUrl ?? '')
        setFileId(r.data.fileId ?? '')
        setFileName(r.data.fileId ? 'Поточний PDF' : '')
      })
      .catch(() => setError('Не вдалося завантажити урок'))
      .finally(() => setLoading(false))
  }, [lessonId])

  async function upload(file: File | undefined) {
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    setError('')
    try {
      const r = await api.post<{ id: string; name: string }>('/training/manage/upload', form)
      setFileId(r.data.id)
      setFileName(r.data.name)
    } catch (e) {
      setError(getErrorMessage(e, 'Не вдалося завантажити файл'))
    }
  }

  async function save() {
    setBusy(true)
    setError('')
    try {
      if (lessonId) {
        await api.patch(`/training/manage/lessons/${lessonId}`, {
          title,
          ...(kind === 'text' ? { content } : {}),
          ...(kind === 'video' ? { videoUrl } : {}),
          ...(kind === 'pdf' && fileId ? { fileId } : {}),
        })
      } else {
        await api.post(`/training/manage/stages/${stageId}/lessons`, {
          kind,
          title,
          ...(kind === 'text' ? { content } : {}),
          ...(kind === 'video' ? { videoUrl } : {}),
          ...(kind === 'pdf' ? { fileId } : {}),
        })
      }
      onSaved()
    } catch (e) {
      setError(getErrorMessage(e, 'Не вдалося зберегти урок'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={lessonId ? 'Редагувати урок' : 'Новий урок'} onClose={onClose} wide>
      {loading ? (
        <p className="text-muted">Завантаження…</p>
      ) : (
        <>
          {!lessonId && (
            <Select label="Тип" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
              {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          )}
          <Input label="Назва" value={title} onChange={(e) => setTitle(e.target.value)} />

          {kind === 'text' && (
            <div className="mb-3 rounded-xl border border-border">
              <RichEditor
                initialContent={content}
                theme={theme}
                allowUpload={can('knowledge.manage_files')}
                onChange={setContent}
              />
            </div>
          )}
          {kind === 'video' && (
            <Input
              label="Посилання на YouTube"
              placeholder="https://www.youtube.com/watch?v=…"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
          )}
          {kind === 'pdf' && (
            <label className="mb-3 block">
              <span className="mb-1 block text-sm font-medium">PDF-файл (до 20 МБ)</span>
              <input type="file" accept="application/pdf,.pdf" onChange={(e) => upload(e.target.files?.[0])} />
              {fileName && <span className="mt-1 block text-xs text-muted">{fileName}</span>}
            </label>
          )}

          {error && <p className="mb-3 text-sm text-danger">{error}</p>}
          <Button onClick={save} disabled={busy || title.trim().length < 2}>
            Зберегти
          </Button>
        </>
      )}
    </Modal>
  )
}

function VersionsDialog({
  lessonId,
  onClose,
  onRestored,
}: {
  lessonId: string
  onClose: () => void
  onRestored: () => void
}) {
  const [rows, setRows] = useState<{ version: number; title: string; createdAt: string }[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get(`/training/manage/lessons/${lessonId}/versions`)
      .then((r) => setRows(r.data))
      .catch(() => setError('Не вдалося завантажити версії'))
  }, [lessonId])

  async function restore(version: number) {
    if (!window.confirm(`Відновити версію ${version}? Вона стане новою актуальною версією.`)) return
    try {
      await api.post(`/training/manage/lessons/${lessonId}/versions/${version}/restore`)
      onRestored()
    } catch (e) {
      setError(getErrorMessage(e, 'Не вдалося відновити версію'))
    }
  }

  return (
    <Modal title="Версії уроку" onClose={onClose}>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {!rows && !error && <p className="text-muted">Завантаження…</p>}
      <ul className="space-y-2">
        {rows?.map((v, i) => (
          <li key={v.version} className="flex items-center justify-between gap-3 text-sm">
            <span>
              v{v.version} · {v.title}
              <span className="ml-2 text-xs text-muted">
                {new Date(v.createdAt).toLocaleString('uk-UA')}
              </span>
            </span>
            {i === 0 ? (
              <span className="text-xs text-muted">поточна</span>
            ) : (
              <Button variant="ghost" onClick={() => restore(v.version)}>
                Відновити
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  )
}

// ───────── Прогрес співробітників ─────────

interface ProgressRow {
  id: string
  name: string
  store: string | null
  roles: string[]
  stagesDone: number
  stagesTotal: number
  percent: number
  currentStage: string | null
  completed: boolean
  testAttempts: number
}

function Progress() {
  const [rows, setRows] = useState<ProgressRow[] | null>(null)
  const [error, setError] = useState('')
  const [onlyTrainees, setOnlyTrainees] = useState(true)

  useEffect(() => {
    api
      .get<{ rows: ProgressRow[] }>('/training/analytics')
      .then((r) => setRows(r.data.rows))
      .catch(() => setError('Не вдалося завантажити прогрес'))
  }, [])

  if (!rows) return <p className="text-muted">{error || 'Завантаження…'}</p>
  const shown = onlyTrainees ? rows.filter((r) => r.roles.includes('Стажер')) : rows

  return (
    <div>
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={onlyTrainees} onChange={(e) => setOnlyTrainees(e.target.checked)} />
        Лише стажери
      </label>
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="px-3 py-2">Співробітник</th>
              <th className="px-3 py-2">Магазин</th>
              <th className="px-3 py-2">Прогрес</th>
              <th className="px-3 py-2">Поточний етап</th>
              <th className="px-3 py-2">Спроб</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2">
                  <Link to={`/profile/${r.id}`} className="text-accent">
                    {r.name}
                  </Link>
                  <div className="text-xs text-muted">{r.roles.join(', ')}</div>
                </td>
                <td className="px-3 py-2">{r.store ?? '—'}</td>
                <td className="px-3 py-2">
                  {r.stagesDone}/{r.stagesTotal} · {r.percent}%
                </td>
                <td className="px-3 py-2">
                  {r.completed ? (
                    <span className="text-accent">Пройдено — можна змінити роль</span>
                  ) : (
                    (r.currentStage ?? '—')
                  )}
                </td>
                <td className="px-3 py-2">{r.testAttempts}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-muted">
                  Немає даних
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
