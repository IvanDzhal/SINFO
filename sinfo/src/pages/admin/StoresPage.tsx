import { useState } from 'react'
import { Plus } from 'lucide-react'
import DataTable, { StatusBadge } from '@/components/DataTable'
import Button from '@/components/Button'
import CreateModal from '@/components/CreateModal'
import EditButton from '@/components/EditButton'
import { useFetch } from '@/hooks/useFetch'

interface Store {
  id: string
  name: string
  address: string | null
  status: string
  regionId: string
  cityId: string
  brandFormatId: string
  region: { name: string }
  city: { name: string }
  brandFormat: { name: string }
}

export default function StoresPage() {
  const { data, loading, error, reload } = useFetch<Store>('/core/stores')
  const [creating, setCreating] = useState(false)

  return (
    <>
      <DataTable
        title="Магазини"
        actionPerm="core.stores.create"
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
          { header: 'Бренд', render: (r) => r.brandFormat.name },
          { header: 'Область', render: (r) => r.region.name },
          { header: 'Місто', render: (r) => r.city.name },
          { header: 'Адреса', render: (r) => r.address ?? '—' },
          { header: 'Статус', render: (r) => <StatusBadge status={r.status} /> },
          {
            header: 'Дії',
            render: (r) => (
              <EditButton
                title="Редагувати магазин"
                endpoint={`/core/stores/${r.id}`}
                perm="core.stores.edit"
                fields={[
                  { name: 'name', label: 'Назва', required: true },
                  {
                    name: 'brandFormatId',
                    label: 'Бренд / формат',
                    kind: 'select',
                    required: true,
                    optionsUrl: '/core/brands',
                  },
                  {
                    name: 'regionId',
                    label: 'Область',
                    kind: 'select',
                    required: true,
                    optionsUrl: '/core/regions',
                  },
                  {
                    name: 'cityId',
                    label: 'Місто',
                    kind: 'select',
                    required: true,
                    optionsUrl: '/core/cities',
                    dependsOn: { field: 'regionId', param: 'regionId' },
                  },
                  { name: 'address', label: 'Адреса' },
                ]}
                initial={{
                  name: r.name,
                  brandFormatId: r.brandFormatId,
                  regionId: r.regionId,
                  cityId: r.cityId,
                  address: r.address ?? '',
                  status: r.status,
                }}
                onSaved={reload}
              />
            ),
          },
        ]}
      />
      {creating && (
        <CreateModal
          title="Новий магазин"
          endpoint="/core/stores"
          fields={[
            { name: 'name', label: 'Назва', required: true },
            {
              name: 'brandFormatId',
              label: 'Бренд / формат',
              kind: 'select',
              required: true,
              optionsUrl: '/core/brands',
            },
            {
              name: 'regionId',
              label: 'Область',
              kind: 'select',
              required: true,
              optionsUrl: '/core/regions',
            },
            {
              name: 'cityId',
              label: 'Місто',
              kind: 'select',
              required: true,
              optionsUrl: '/core/cities',
              dependsOn: { field: 'regionId', param: 'regionId' },
            },
            { name: 'address', label: 'Адреса' },
          ]}
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