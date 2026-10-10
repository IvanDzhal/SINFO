import { useState } from 'react'
import { Plus } from 'lucide-react'
import DataTable, { StatusBadge } from '@/components/DataTable'
import Button from '@/components/Button'
import CreateModal from '@/components/CreateModal'
import { useFetch } from '@/hooks/useFetch'
import EditButton from '@/components/EditButton'

interface Brand {
  id: string
  name: string
  status: string
}

export default function BrandsPage() {
  const { data, loading, error, reload } = useFetch<Brand>('/core/brands')
  const [creating, setCreating] = useState(false)

  return (
    <>
      <DataTable
        title="Бренди та формати"
        actionPerm="core.brands.create"
        rows={data}
        loading={loading}
        error={error}
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} /> Створити
          </Button>
        }
        columns={[
          { header: 'Назва', render: (r) => r.name },
          { header: 'Статус', render: (r) => <StatusBadge status={r.status} /> },
          {
            header: 'Дії',
            render: (r) => (
              <EditButton
                title="Редагувати бренд"
                endpoint={`/core/brands/${r.id}`}
                perm="core.brands.edit"
                fields={[{ name: 'name', label: 'Назва', required: true }]}
                initial={{ name: r.name, status: r.status }}
                onSaved={reload}
              />
            ),
          },
        ]}
      />
      {creating && (
        <CreateModal
          title="Новий бренд / формат"
          endpoint="/core/brands"
          fields={[{ name: 'name', label: 'Назва', required: true }]}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false)
            reload()
          }}
        />
      )}
    </>
  )
}