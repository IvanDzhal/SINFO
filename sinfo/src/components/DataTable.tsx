import type { ReactNode } from 'react'

export interface Column<T> {
  header: string
  render: (row: T) => ReactNode
}

interface Props<T> {
  title: string
  columns: Column<T>[]
  rows: T[]
  loading: boolean
  error: string
  action?: ReactNode
}

export default function DataTable<T extends { id: string }>({
  title,
  columns,
  rows,
  loading,
  error,
  action,
}: Props<T>) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{title}</h2>
        {action}
      </div>
      {loading && <p className="text-muted">Завантаження...</p>}
      {error && <p className="text-danger">{error}</p>}
      {!loading && !error && (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-160 text-sm">
            <thead className="bg-surface-2 text-left text-muted">
              <tr>
                {columns.map((c) => (
                  <th key={c.header} className="px-4 py-2.5 font-medium">
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  {columns.map((c) => (
                    <td key={c.header} className="px-4 py-2.5">
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-6 text-center text-muted">
                    Поки нічого немає
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function StatusBadge({ status }: { status: string }) {
  return status === 'active' ? (
    <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">
      Активний
    </span>
  ) : (
    <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-muted">
      Неактивний
    </span>
  )
}