import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { api } from '@/services/api'
import { getErrorMessage } from '@/utils/errors'
import QuestionEditor, { TYPE_LABEL, type QType, type Question } from './QuestionEditor'

const TYPES: QType[] = ['single', 'multiple', 'matching', 'input']

export default function QuestionsPanel({
  testId,
  status,
  needed,
  questions,
  canEdit,
  onChanged,
}: {
  testId: string
  status: 'draft' | 'published' | 'archived'
  needed: number
  questions: Question[]
  canEdit: boolean
  onChanged: () => void
}) {
  const [list, setList] = useState(questions)
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState<QType | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setList(questions)
  }, [questions])

  const valid = list.filter((q) => q.errors.length === 0).length

  async function reorder(next: Question[]) {
    setError('')
    setList(next)
    try {
      await api.put(`/testing/manage/tests/${testId}/questions/order`, {
        ids: next.map((q) => q.id),
      })
      onChanged()
    } catch (err) {
      setError(getErrorMessage(err, 'Не вдалося змінити порядок'))
      setList(questions)
    }
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= list.length || from === to) return
    const next = [...list]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    reorder(next)
  }

  async function remove(q: Question) {
    const text =
      status === 'draft'
        ? 'Видалити питання?'
        : 'Питання буде архівовано (історія спроб збережеться). Продовжити?'
    if (!window.confirm(text)) return
    setError('')
    try {
      await api.delete(`/testing/manage/questions/${q.id}`)
      onChanged()
    } catch (err) {
      setError(getErrorMessage(err, 'Не вдалося видалити питання'))
    }
  }

  return (
    <div>
      <p className={clsx('mb-2 text-sm', valid >= needed ? 'text-success' : 'text-muted')}>
        Питань: {list.length} · валідних: {valid} · потрібно для тесту: {needed}
      </p>
      {error && <p className="mb-2 text-sm text-danger">{error}</p>}

      {list.length === 0 && <p className="text-sm text-muted">Питань поки немає.</p>}

      {list.map((q, i) => (
        <div
          key={q.id}
          draggable={canEdit && openId !== q.id}
          onDragStart={() => setDragIndex(i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragIndex !== null) move(dragIndex, i)
            setDragIndex(null)
          }}
          onDragEnd={() => setDragIndex(null)}
          className={clsx(
            'border-t border-border py-2 first:border-t-0',
            dragIndex === i && 'opacity-50',
          )}
        >
          <div className="flex items-start gap-2">
            {canEdit && (
              <span className="mt-0.5 shrink-0 cursor-grab text-muted" aria-hidden>
                <GripVertical size={16} />
              </span>
            )}
            <span className="w-6 shrink-0 text-sm text-muted">{i + 1}.</span>
            <button
              type="button"
              onClick={() => setOpenId(openId === q.id ? null : q.id)}
              className="min-w-0 flex-1 text-left"
            >
              <p className="truncate text-sm">{q.text || '(без тексту)'}</p>
              <p className="text-xs text-muted">
                {TYPE_LABEL[q.type]} · {q.points} бал.
              </p>
            </button>
            {canEdit && (
              <div className="flex shrink-0 items-center gap-1 text-muted">
                <button
                  type="button"
                  aria-label="Вгору"
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                  className="hover:text-ink disabled:opacity-30"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Вниз"
                  disabled={i === list.length - 1}
                  onClick={() => move(i, i + 1)}
                  className="hover:text-ink disabled:opacity-30"
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Видалити питання"
                  onClick={() => remove(q)}
                  className="ml-1 hover:text-danger"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>

          {q.errors.length > 0 && openId !== q.id && (
            <p className="ml-14 mt-1 text-xs text-danger">{q.errors.join('; ')}</p>
          )}

          {openId === q.id && (
            <div className="ml-0 mt-3 rounded-xl border border-border p-3 sm:ml-8">
              {canEdit ? (
                <QuestionEditor
                  testId={testId}
                  type={q.type}
                  question={q}
                  onSaved={() => {
                    setOpenId(null)
                    onChanged()
                  }}
                  onCancel={() => setOpenId(null)}
                />
              ) : (
                <p className="text-sm text-muted">Редагування недоступне.</p>
              )}
            </div>
          )}
        </div>
      ))}

      {canEdit && !adding && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">Додати питання:</span>
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setAdding(t)
                setOpenId(null)
              }}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-3 py-1 text-sm hover:border-accent"
            >
              <Plus size={12} /> {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      )}

      {adding && (
        <div className="mt-3 rounded-xl border border-border p-3">
          <QuestionEditor
            testId={testId}
            type={adding}
            question={null}
            onSaved={() => {
              setAdding(null)
              onChanged()
            }}
            onCancel={() => setAdding(null)}
          />
        </div>
      )}
    </div>
  )
}