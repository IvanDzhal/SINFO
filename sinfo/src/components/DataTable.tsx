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
}

export default function DataTable<T extends { id: string }>({
  title,
  columns,
  rows,
  loading,
  error,
}: Props<T>) {
  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">{title}</h2>
      {loading && <p>Завантаження...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-500">
              <tr>
                {columns.map((c) => (
                  <th key={c.header} className="px-4 py-2 font-medium">
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-neutral-100">
                  {columns.map((c) => (
                    <td key={c.header} className="px-4 py-2">
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-6 text-center text-neutral-400">
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
    <span className="text-green-600">🟢 Активний</span>
  ) : (
    <span className="text-neutral-400">⚪ Неактивний</span>
  )
}