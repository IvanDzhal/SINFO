import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { api } from '@/services/api'
import Button from '@/components/Button'
import { getErrorMessage } from '@/utils/errors'

export type QType = 'single' | 'multiple' | 'matching' | 'input'
export type Difficulty = 'easy' | 'medium' | 'hard'

export interface Question {
  id: string
  type: QType
  text: string
  explanation: string
  difficulty: Difficulty
  points: number
  position: number
  accepted: { kind: 'text' | 'number'; answers: string[]; tolerance?: number } | null
  options: { id: string; label: string; matchLabel: string | null; isCorrect: boolean }[]
  errors: string[]
}

export const TYPE_LABEL: Record<QType, string> = {
  single: 'Один варіант',
  multiple: 'Декілька варіантів',
  matching: 'Відповідність',
  input: 'Число / текст',
}

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Легке',
  medium: 'Середнє',
  hard: 'Складне',
}

interface LocalOption {
  key: string
  id?: string
  label: string
  matchLabel: string
  isCorrect: boolean
}

let counter = 0
const nextKey = () => `o${(counter += 1)}`
const blank = (): LocalOption => ({ key: nextKey(), label: '', matchLabel: '', isCorrect: false })

function initOptions(type: QType, q: Question | null): LocalOption[] {
  if (q && q.options.length > 0) {
    return q.options.map((o) => ({
      key: nextKey(),
      id: o.id,
      label: o.label,
      matchLabel: o.matchLabel ?? '',
      isCorrect: o.isCorrect,
    }))
  }
  if (type === 'input') return []
  if (type === 'matching') return [blank(), blank(), blank()]
  return [blank(), blank(), blank(), blank()]
}

const inputClass =
  'w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent'

export default function QuestionEditor({
  testId,
  type,
  question,
  onSaved,
  onCancel,
}: {
  testId: string
  type: QType
  question: Question | null
  onSaved: () => void
  onCancel: () => void
}) {
  const [group] = useState(() => `q${(counter += 1)}`)
  const [text, setText] = useState(question?.text ?? '')
  const [explanation, setExplanation] = useState(question?.explanation ?? '')
  const [difficulty, setDifficulty] = useState<Difficulty>(question?.difficulty ?? 'medium')
  const [points, setPoints] = useState(String(question?.points ?? 2))
  const [options, setOptions] = useState<LocalOption[]>(() => initOptions(type, question))
  const [acceptedKind, setAcceptedKind] = useState<'text' | 'number'>(
    question?.accepted?.kind ?? 'text',
  )
  const [answers, setAnswers] = useState<string[]>(
    question?.accepted?.answers && question.accepted.answers.length > 0
      ? question.accepted.answers
      : [''],
  )
  const [tolerance, setTolerance] = useState(
    question?.accepted?.tolerance !== undefined ? String(question.accepted.tolerance) : '',
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function patch(key: string, change: Partial<LocalOption>) {
    setOptions((l) => l.map((o) => (o.key === key ? { ...o, ...change } : o)))
  }

  function setCorrectSingle(key: string) {
    setOptions((l) => l.map((o) => ({ ...o, isCorrect: o.key === key })))
  }

  function removeOption(key: string) {
    setOptions((l) => l.filter((o) => o.key !== key))
  }

  async function save() {
    setError('')
    const pts = Number(points)
    if (!Number.isInteger(pts) || pts < 1 || pts > 100) {
      setError('Бали: ціле число від 1 до 100')
      return
    }

    const body: Record<string, unknown> = {
      text: text.trim(),
      explanation: explanation.trim(),
      difficulty,
      points: pts,
    }

    if (type === 'input') {
      const accepted: Record<string, unknown> = {
        kind: acceptedKind,
        answers: answers.map((a) => a.trim()).filter(Boolean),
      }
      if (acceptedKind === 'number' && tolerance.trim()) {
        const tol = Number(tolerance.replace(',', '.'))
        if (!Number.isFinite(tol) || tol < 0) {
          setError('Похибка має бути числом, не меншим за 0')
          return
        }
        accepted.tolerance = tol
      }
      body.accepted = accepted
    } else {
      body.options = options
        .filter((o) => o.label.trim() || o.matchLabel.trim())
        .map((o) => ({
          id: o.id,
          label: o.label.trim(),
          matchLabel: type === 'matching' ? o.matchLabel.trim() : undefined,
          isCorrect: type === 'matching' ? undefined : o.isCorrect,
        }))
    }

    setSaving(true)
    try {
      if (question) {
        await api.patch(`/testing/manage/questions/${question.id}`, body)
      } else {
        await api.post(`/testing/manage/tests/${testId}/questions`, { type, ...body })
      }
      onSaved()
    } catch (err) {
      setError(getErrorMessage(err, 'Не вдалося зберегти питання'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase text-muted">{TYPE_LABEL[type]}</p>

      <label className="mb-3 block">
        <span className="mb-1 block text-sm font-medium">Текст питання</span>
        <textarea
          className={`${inputClass} resize-y`}
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>

      {(type === 'single' || type === 'multiple') && (
        <div className="mb-3">
          <p className="mb-1 text-sm font-medium">
            Варіанти відповіді{' '}
            <span className="font-normal text-muted">
              ({type === 'single' ? 'оберіть одну правильну' : 'позначте всі правильні'})
            </span>
          </p>
          {options.map((o, i) => (
            <div key={o.key} className="mb-2 flex items-center gap-2">
              {type === 'single' ? (
                <input
                  type="radio"
                  name={group}
                  checked={o.isCorrect}
                  onChange={() => setCorrectSingle(o.key)}
                  aria-label="Правильна відповідь"
                />
              ) : (
                <input
                  type="checkbox"
                  checked={o.isCorrect}
                  onChange={(e) => patch(o.key, { isCorrect: e.target.checked })}
                  aria-label="Правильна відповідь"
                />
              )}
              <input
                className={inputClass}
                placeholder={`Варіант ${i + 1}`}
                value={o.label}
                onChange={(e) => patch(o.key, { label: e.target.value })}
              />
              <button
                type="button"
                aria-label="Видалити варіант"
                disabled={options.length <= 2}
                onClick={() => removeOption(o.key)}
                className="shrink-0 text-muted hover:text-danger disabled:opacity-30"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setOptions((l) => [...l, blank()])}
            className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
          >
            <Plus size={14} /> Додати варіант
          </button>
        </div>
      )}

      {type === 'matching' && (
        <div className="mb-3">
          <p className="mb-1 text-sm font-medium">
            Пари <span className="font-normal text-muted">(зліва ліва частина, справа правильна пара)</span>
          </p>
          {options.map((o, i) => (
            <div key={o.key} className="mb-2 flex items-center gap-2">
              <input
                className={inputClass}
                placeholder={`Ліва частина ${i + 1}`}
                value={o.label}
                onChange={(e) => patch(o.key, { label: e.target.value })}
              />
              <span className="text-muted">↔</span>
              <input
                className={inputClass}
                placeholder="Пара"
                value={o.matchLabel}
                onChange={(e) => patch(o.key, { matchLabel: e.target.value })}
              />
              <button
                type="button"
                aria-label="Видалити пару"
                disabled={options.length <= 2}
                onClick={() => removeOption(o.key)}
                className="shrink-0 text-muted hover:text-danger disabled:opacity-30"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setOptions((l) => [...l, blank()])}
            className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
          >
            <Plus size={14} /> Додати пару
          </button>
        </div>
      )}

      {type === 'input' && (
        <div className="mb-3">
          <label className="mb-2 block max-w-xs">
            <span className="mb-1 block text-sm font-medium">Тип відповіді</span>
            <select
              className={inputClass}
              value={acceptedKind}
              onChange={(e) => setAcceptedKind(e.target.value as 'text' | 'number')}
            >
              <option value="text">Текст</option>
              <option value="number">Число</option>
            </select>
          </label>
          <p className="mb-1 text-sm font-medium">
            Допустимі відповіді{' '}
            <span className="font-normal text-muted">(можна кілька варіантів написання)</span>
          </p>
          {answers.map((a, i) => (
            <div key={i} className="mb-2 flex items-center gap-2">
              <input
                className={inputClass}
                placeholder={acceptedKind === 'number' ? 'Наприклад 12,5' : 'Правильна відповідь'}
                value={a}
                onChange={(e) =>
                  setAnswers((l) => l.map((x, idx) => (idx === i ? e.target.value : x)))
                }
              />
              <button
                type="button"
                aria-label="Видалити відповідь"
                disabled={answers.length <= 1}
                onClick={() => setAnswers((l) => l.filter((_, idx) => idx !== i))}
                className="shrink-0 text-muted hover:text-danger disabled:opacity-30"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setAnswers((l) => [...l, ''])}
            className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
          >
            <Plus size={14} /> Додати варіант відповіді
          </button>
          {acceptedKind === 'number' && (
            <label className="mt-3 block max-w-xs">
              <span className="mb-1 block text-sm font-medium">
                Допустима похибка ± <span className="font-normal text-muted">(необов'язково)</span>
              </span>
              <input
                className={inputClass}
                placeholder="0"
                value={tolerance}
                onChange={(e) => setTolerance(e.target.value)}
              />
            </label>
          )}
        </div>
      )}

      <div className="mb-3 grid grid-cols-2 gap-3 sm:max-w-sm">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Бали</span>
          <input
            type="number"
            className={inputClass}
            value={points}
            onChange={(e) => setPoints(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Складність</span>
          <select
            className={inputClass}
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
          >
            {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABEL[d]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mb-3 block">
        <span className="mb-1 block text-sm font-medium">
          Пояснення до відповіді <span className="font-normal text-muted">(необов'язково)</span>
        </span>
        <textarea
          className={`${inputClass} resize-y`}
          rows={2}
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
        />
      </label>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Скасувати
        </Button>
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? 'Збереження...' : 'Зберегти питання'}
        </Button>
      </div>
    </div>
  )
}