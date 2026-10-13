import clsx from 'clsx'

export type MyStatus = 'not_started' | 'in_progress' | 'passed' | 'failed' | 'overdue'

const MAP: Record<MyStatus, { label: string; cls: string }> = {
  not_started: { label: 'Не розпочато', cls: 'bg-surface-2 text-muted' },
  in_progress: { label: 'В процесі', cls: 'bg-accent-soft text-accent' },
  passed: { label: 'Пройдено', cls: 'bg-success-soft text-success' },
  failed: { label: 'Не пройдено', cls: 'bg-surface-2 text-danger' },
  overdue: { label: 'Протерміновано', cls: 'bg-surface-2 text-danger' },
}

export default function TestStatusBadge({ status }: { status: MyStatus }) {
  const s = MAP[status]
  return (
    <span className={clsx('rounded-full px-2.5 py-0.5 text-xs font-medium', s.cls)}>{s.label}</span>
  )
}