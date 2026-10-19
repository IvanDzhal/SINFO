import { useEffect, useState } from 'react'
import axios from 'axios'
import { X } from 'lucide-react'
import clsx from 'clsx'
import { api } from '@/services/api'
import Button from '@/components/Button'
import { Input } from '@/components/Field'
import { useCan } from '@/hooks/useCan'
import { getErrorMessage } from '@/utils/errors'
import QuestionsPanel from '@/components/QuestionsPanel'
import type { Question } from '@/components/QuestionEditor'

type Status = 'draft' | 'published' | 'archived'
type Kind = 'GLOBAL' | 'REGION' | 'STORE' | 'ROLE' | 'BRAND'
type Mode = 'none' | 'all' | 'custom'

interface Named {
  id: string
  name: string
}
interface Options {
  global: boolean
  regions: Named[]
  stores: (Named & { regionId: string })[]
  roles: Named[]
  brands: Named[]
  categories: (Named & { parentId: string | null })[]
}
interface Rule {
  kind: Kind
  targetId: string | null
}
interface TestData {
  id: string
  title: string
  description: string
  categoryId: string | null
  linkedItem: { id: string; title: string } | null
  status: Status
  isRequired: boolean
  deadline: string | null
  questionCount: number
  timeLimitMinutes: number
  passingScorePercent: number
  maxAttempts: number
  visibility: Rule[]
  errors: string[]
  questions?: Question[]
}

const STATUS_LABEL: Record<Status, string> = {
  draft: 'Чернетка',
  published: 'Опубліковано',
  archived: 'В архіві',
}

const inputClass =
  'w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent disabled:opacity-60'

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value]
}

function toLocalInput(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
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

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-2xl border border-border bg-surface p-4">
      <h3 className="font-medium">{title}</h3>
      {hint && <p className="mb-3 text-sm text-muted">{hint}</p>}
      <div className={hint ? '' : 'mt-3'}>{children}</div>
    </section>
  )
}

function ItemPicker({
  value,
  onChange,
}: {
  value: { id: string; title: string } | null
  onChange: (v: { id: string; title: string } | null) => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<{ id: string; title: string; type: string }[]>([])

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setResults([])
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      api
        .get('/knowledge/items/search', { params: { q: term } })
        .then((r) => !cancelled && setResults(r.data))
        .catch(() => !cancelled && setResults([]))
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [q])

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm">
        <span className="truncate">{value.title}</span>
        <button
          type="button"
          aria-label="Прибрати"
          onClick={() => onChange(null)}
          className="ml-3 shrink-0 text-muted hover:text-ink"
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        className={inputClass}
        placeholder="Знайти інструкцію або матеріал…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
          {results.map((r) => (
            <button
              type="button"
              key={r.id}
              onClick={() => {
                onChange({ id: r.id, title: r.title })
                setQ('')
                setResults([])
              }}
              className="block w-full truncate border-t border-border px-3 py-2 text-left text-sm first:border-t-0 hover:bg-surface-2"
            >
              {r.title}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TestEditorDrawer({
  testId,
  onClose,
  onChanged,
}: {
  testId: string | null
  onClose: () => void
  onChanged: () => void
}) {
  const can = useCan()
  const [id, setId] = useState<string | null>(testId)
  const [loaded, setLoaded] = useState(false)
  const [options, setOptions] = useState<Options | null>(null)

  const [status, setStatus] = useState<Status>('draft')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [linked, setLinked] = useState<{ id: string; title: string } | null>(null)
  const [isRequired, setIsRequired] = useState(false)
  const [deadline, setDeadline] = useState('')
  const [questionCount, setQuestionCount] = useState('20')
  const [timeLimit, setTimeLimit] = useState('25')
  const [passing, setPassing] = useState('80')
  const [maxAttempts, setMaxAttempts] = useState('2')
  const [mode, setMode] = useState<Mode>('none')
  const [regionIds, setRegionIds] = useState<string[]>([])
  const [storeIds, setStoreIds] = useState<string[]>([])
  const [brandIds, setBrandIds] = useState<string[]>([])
  const [roleIds, setRoleIds] = useState<string[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [errors, setErrors] = useState<string[]>([])

  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function apply(t: TestData) {
    setStatus(t.status)
    setTitle(t.title)
    setDescription(t.description)
    setCategoryId(t.categoryId ?? '')
    setLinked(t.linkedItem)
    setIsRequired(t.isRequired)
    setDeadline(toLocalInput(t.deadline))
    setQuestionCount(String(t.questionCount))
    setTimeLimit(String(t.timeLimitMinutes))
    setPassing(String(t.passingScorePercent))
    setMaxAttempts(String(t.maxAttempts))
    const pick = (k: Kind) =>
      t.visibility.filter((x) => x.kind === k && x.targetId).map((x) => x.targetId as string)
    setMode(
      t.visibility.length === 0
        ? 'none'
        : t.visibility.some((x) => x.kind === 'GLOBAL')
          ? 'all'
          : 'custom',
    )
    setRegionIds(pick('REGION'))
    setStoreIds(pick('STORE'))
    setBrandIds(pick('BRAND'))
    setRoleIds(pick('ROLE'))
    setQuestions(t.questions ?? [])
    setErrors(t.errors)
  }

  async function reload(testId: string) {
    const r = await api.get<TestData>(`/testing/manage/tests/${testId}`)
    apply(r.data)
  }

  useEffect(() => {
    let cancelled = false
    const jobs: Promise<unknown>[] = [
      api.get<Options>('/testing/manage/options').then((r) => setOptions(r.data)),
    ]
    if (testId) jobs.push(reload(testId))
    Promise.all(jobs)
      .then(() => !cancelled && setLoaded(true))
      .catch((err) => !cancelled && setError(getErrorMessage(err, 'Не вдалося завантажити')))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && requestClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function requestClose() {
    if (dirty && !window.confirm('Закрити без збереження змін?')) return
    onClose()
  }

  function touch() {
    setDirty(true)
  }

  function rulesPayload() {
    if (mode === 'none') return []
    if (mode === 'all') return [{ kind: 'GLOBAL' as const }]
    return [
      ...regionIds.map((t) => ({ kind: 'REGION' as const, targetId: t })),
      ...storeIds.map((t) => ({ kind: 'STORE' as const, targetId: t })),
      ...brandIds.map((t) => ({ kind: 'BRAND' as const, targetId: t })),
      ...roleIds.map((t) => ({ kind: 'ROLE' as const, targetId: t })),
    ]
  }

  async function save(): Promise<string | null> {
    setError('')
    setMessage('')
    if (title.trim().length < 2) {
      setError('Введіть назву тесту')
      return null
    }
    const nums = {
      questionCount: Number(questionCount),
      timeLimitMinutes: Number(timeLimit),
      passingScorePercent: Number(passing),
      maxAttempts: Number(maxAttempts),
    }
    const bad =
      !Number.isInteger(nums.questionCount) || nums.questionCount < 1 || nums.questionCount > 100
        ? 'Кількість питань: від 1 до 100'
        : !Number.isInteger(nums.timeLimitMinutes) || nums.timeLimitMinutes < 1 || nums.timeLimitMinutes > 240
          ? 'Час: від 1 до 240 хвилин'
          : !Number.isInteger(nums.passingScorePercent) || nums.passingScorePercent < 1 || nums.passingScorePercent > 100
            ? 'Прохідний відсоток: від 1 до 100'
            : !Number.isInteger(nums.maxAttempts) || nums.maxAttempts < 0 || nums.maxAttempts > 20
              ? 'Спроб: від 0 до 20 (0 = без обмеження)'
              : ''
    if (bad) {
      setError(bad)
      return null
    }

    setBusy(true)
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim(),
        categoryId: categoryId || null,
        linkedItemId: linked?.id ?? null,
        ...nums,
        visibility: rulesPayload(),
      }
      if (can('testing.manage_required')) body.isRequired = isRequired
      if (can('testing.manage_deadlines')) {
        body.deadline = deadline ? new Date(deadline).toISOString() : null
      }

      let savedId = id
      if (!savedId) {
        const r = await api.post<{ id: string }>('/testing/manage/tests', body)
        savedId = r.data.id
        setId(savedId)
      } else {
        await api.patch(`/testing/manage/tests/${savedId}`, body)
      }
      await reload(savedId)
      setDirty(false)
      onChanged()
      return savedId
    } catch (err) {
      setError(getErrorMessage(err, 'Не вдалося зберегти'))
      return null
    } finally {
      setBusy(false)
    }
  }

  async function onSave() {
    const savedId = await save()
    if (savedId) setMessage('Збережено')
  }

  async function onPublish() {
    const savedId = await save()
    if (!savedId) return
    setBusy(true)
    try {
      await api.post(`/testing/manage/tests/${savedId}/publish`)
      onChanged()
      onClose()
    } catch (err) {
      const list = axios.isAxiosError(err) ? err.response?.data?.errors : null
      if (Array.isArray(list)) {
        setErrors(list)
        setError('Неможливо опублікувати. Виправте помилки нижче')
      } else {
        setError(getErrorMessage(err, 'Не вдалося опублікувати'))
      }
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
    if (!window.confirm('Перенести тест в архів? Він зникне у користувачів.')) return
    run(
      () => api.post(`/testing/manage/tests/${id}/archive`),
      () => {
        onChanged()
        onClose()
      },
    )
  }

  function restore() {
    run(
      () => api.post(`/testing/manage/tests/${id}/restore`),
      async () => {
        await reload(id as string)
        onChanged()
        setMessage('Повернуто в чернетки')
      },
    )
  }

  function remove() {
    if (!window.confirm('Перемістити тест у кошик? Його можна відновити протягом 30 днів, спроби й результати збережуться.')) return
    run(
      () => api.delete(`/testing/manage/tests/${id}`),
      () => {
        onChanged()
        onClose()
      },
    )
  }

  const archived = status === 'archived'
  const published = status === 'published'

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={requestClose}>
      <div
        className="flex h-full w-full flex-col bg-bg sm:max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <h2 className="truncate text-lg font-semibold">
              {id ? 'Редагування тесту' : 'Новий тест'}
            </h2>
            {id && (
              <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
                {STATUS_LABEL[status]}
              </span>
            )}
          </div>
          <button onClick={requestClose} aria-label="Закрити" className="shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!loaded ? (
            error ? (
              <p className="text-danger">{error}</p>
            ) : (
              <p className="text-muted">Завантаження...</p>
            )
          ) : (
            <>
              {archived && (
                <p className="mb-4 rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">
                  Тест в архіві. Щоб редагувати, поверніть його в чернетки.
                </p>
              )}

              <Section title="Основне">
                <Input
                  label="Назва"
                  value={title}
                  disabled={archived}
                  onChange={(e) => {
                    setTitle(e.target.value)
                    touch()
                  }}
                />
                <label className="mb-3 block">
                  <span className="mb-1 block text-sm font-medium">Опис</span>
                  <textarea
                    className={`${inputClass} resize-y`}
                    rows={2}
                    value={description}
                    disabled={archived}
                    onChange={(e) => {
                      setDescription(e.target.value)
                      touch()
                    }}
                  />
                </label>
                <label className="mb-3 block">
                  <span className="mb-1 block text-sm font-medium">Категорія</span>
                  <select
                    className={inputClass}
                    value={categoryId}
                    disabled={archived}
                    onChange={(e) => {
                      setCategoryId(e.target.value)
                      touch()
                    }}
                  >
                    <option value="">— оберіть —</option>
                    {options?.categories
                      .filter((c) => !c.parentId)
                      .map((root) => (
                        <optgroup key={root.id} label={root.name}>
                          <option value={root.id}>{root.name}</option>
                          {options.categories
                            .filter((c) => c.parentId === root.id)
                            .map((k) => (
                              <option key={k.id} value={k.id}>{`— ${k.name}`}</option>
                            ))}
                        </optgroup>
                      ))}
                  </select>
                </label>
                <div>
                  <span className="mb-1 block text-sm font-medium">
                    Матеріал для підготовки (необов'язково)
                  </span>
                  <ItemPicker
                    value={linked}
                    onChange={(v) => {
                      setLinked(v)
                      touch()
                    }}
                  />
                </div>
              </Section>

              <Section
                title="Параметри"
                hint="За замовчуванням: 20 питань, 25 хвилин, 80%, 2 спроби. Для кожного тесту можна змінити."
              >
                <div className="grid grid-cols-2 gap-x-3 sm:grid-cols-4">
                  <Input
                    label="Питань у спробі"
                    type="number"
                    value={questionCount}
                    disabled={archived}
                    onChange={(e) => {
                      setQuestionCount(e.target.value)
                      touch()
                    }}
                  />
                  <Input
                    label="Час, хв"
                    type="number"
                    value={timeLimit}
                    disabled={archived}
                    onChange={(e) => {
                      setTimeLimit(e.target.value)
                      touch()
                    }}
                  />
                  <Input
                    label="Прохідний, %"
                    type="number"
                    value={passing}
                    disabled={archived}
                    onChange={(e) => {
                      setPassing(e.target.value)
                      touch()
                    }}
                  />
                  <Input
                    label="Спроб (0 = без обмеж.)"
                    type="number"
                    value={maxAttempts}
                    disabled={archived}
                    onChange={(e) => {
                      setMaxAttempts(e.target.value)
                      touch()
                    }}
                  />
                </div>

                {can('testing.manage_required') && (
                  <label className="mt-1 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={isRequired}
                      disabled={archived}
                      onChange={(e) => {
                        setIsRequired(e.target.checked)
                        touch()
                      }}
                    />
                    Обов'язковий тест
                  </label>
                )}

                {can('testing.manage_deadlines') && (
                  <label className="mt-3 block max-w-xs">
                    <span className="mb-1 block text-sm font-medium">
                      Дедлайн (після нього тест пройти не можна)
                    </span>
                    <input
                      type="datetime-local"
                      className={inputClass}
                      value={deadline}
                      disabled={archived}
                      onChange={(e) => {
                        setDeadline(e.target.value)
                        touch()
                      }}
                    />
                  </label>
                )}
              </Section>

              <Section
                title="Кому призначено"
                hint="Без призначення тест не бачить ніхто. Умови поєднуються: де І бренд І ролі, а всередині групи достатньо одного збігу."
              >
                {options && (
                  <>
                    <div className="mb-3 flex gap-2">
                      {options.global && (
                        <Pill
                          label="Всім"
                          active={mode === 'all'}
                          onClick={() => {
                            setMode('all')
                            touch()
                          }}
                        />
                      )}
                      <Pill
                        label="Вибраним"
                        active={mode === 'custom'}
                        onClick={() => {
                          setMode('custom')
                          touch()
                        }}
                      />
                    </div>

                    {mode === 'custom' && (
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
                                    touch()
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
                                    touch()
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        {options.brands.length > 0 && (
                          <div>
                            <p className="mb-1 text-xs text-muted">Бренди</p>
                            <div className="flex flex-wrap gap-2">
                              {options.brands.map((b) => (
                                <Pill
                                  key={b.id}
                                  label={b.name}
                                  active={brandIds.includes(b.id)}
                                  onClick={() => {
                                    setBrandIds((l) => toggle(l, b.id))
                                    touch()
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
                                    touch()
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </Section>

              <Section title="Питання">
                {!id ? (
                  <p className="text-sm text-muted">
                    Збережіть тест, щоб додавати питання.
                  </p>
                ) : (
                  <QuestionsPanel
                    testId={id}
                    status={status}
                    needed={Number(questionCount) || 20}
                    questions={questions}
                    canEdit={!archived && can('testing.manage_questions')}
                    onChanged={() => {
                      reload(id).catch(() => {})
                      onChanged()
                    }}
                  />
                )}
              </Section>

              <Section title="Готовність до публікації">
                {!id ? (
                  <p className="text-sm text-muted">Збережіть тест, щоб побачити перевірку.</p>
                ) : errors.length === 0 ? (
                  <p className="text-sm text-success">Усе готово до публікації</p>
                ) : (
                  <ul className="space-y-1 text-sm text-danger">
                    {errors.map((e, i) => (
                      <li key={i}>• {e}</li>
                    ))}
                  </ul>
                )}
              </Section>
            </>
          )}
        </div>

        {loaded && (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border bg-surface px-4 py-3">
            {message && <span className="text-sm text-success">{message}</span>}
            {error && <span className="text-sm text-danger">{error}</span>}

            {id && can('testing.delete') && (
              <Button variant="ghost" onClick={remove} disabled={busy}>
                <span className="text-danger">Видалити</span>
              </Button>
            )}
            {published && can('testing.archive') && (
              <Button variant="ghost" onClick={archive} disabled={busy}>
                В архів
              </Button>
            )}
            {archived ? (
              can('testing.archive') && (
                <Button onClick={restore} disabled={busy}>
                  Відновити в чернетки
                </Button>
              )
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={onSave}
                  disabled={busy || (!!id && !dirty)}
                >
                  {published ? 'Зберегти зміни' : 'Зберегти чернетку'}
                </Button>
                {!published && can('testing.publish') && (
                  <Button onClick={onPublish} disabled={busy}>
                    Опублікувати
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}