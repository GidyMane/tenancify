'use client'

import { useMemo, useState } from 'react'
import { Building, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { EmptyState, SearchInput, primaryButton } from '@/components/page'
import { Button } from '@/components/ui/button'
import { formatKsh, percent } from '@/lib/format'
import { useHouses, type House } from '@/lib/houses'
import { useProperties, type Property } from '@/lib/properties'
import { PropertyDetailsDialog } from './property-details-dialog'
import { PropertyFormDialog } from './property-form-dialog'

type OpenDialog = { type: 'form'; property: Property | null } | { type: 'details'; property: Property; deleting?: boolean } | null

const rowButton = 'h-9 border-slate-300 bg-white px-3 text-slate-700 hover:bg-slate-100'

export function PropertyManagement() {
  const { properties, mode, error, createProperty, updateProperty, deleteProperty } = useProperties()
  const { allHouses: houses } = useHouses()
  const [query, setQuery] = useState('')
  const [dialog, setDialog] = useState<OpenDialog>(null)

  const housesByProperty = useMemo(() => {
    const grouped = new Map<string, House[]>()
    houses.forEach((house) => grouped.set(house.propertyId, [...(grouped.get(house.propertyId) ?? []), house]))
    return grouped
  }, [houses])

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    return properties.filter((property) => !term || [property.name, property.address, property.location].some((value) => value.toLowerCase().includes(term)))
  }, [properties, query])

  const addButton = <Button onClick={() => setDialog({ type: 'form', property: null })} className={primaryButton}><Plus data-icon="inline-start" />Add property</Button>

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={query} onChange={setQuery} placeholder="Search name, address or location" />
        {addButton}
      </div>

      {mode === 'error' ? (
        <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">Properties couldn’t be loaded: {error?.message}</p>
      ) : mode === 'loading' ? (
        <p className="rounded-2xl border border-slate-200/80 bg-white px-5 py-12 text-center text-sm text-slate-400">Loading properties…</p>
      ) : !properties.length ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white">
          <EmptyState icon={Building} title="No properties yet" description="A property groups your houses, sets the water rate and the notice period. Add one to start adding houses." action={addButton} />
        </div>
      ) : !visible.length ? (
        <p className="rounded-2xl border border-slate-200/80 bg-white px-5 py-12 text-center text-sm text-slate-400">No properties match your search.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((property) => {
            const own = housesByProperty.get(property.id) ?? []
            const occupied = own.filter((house) => house.tenant).length
            const rentRoll = own.filter((house) => house.tenant).reduce((sum, house) => sum + house.defaultMonthlyRent, 0)
            return (
              <article key={property.id} className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)]">
                <button type="button" onClick={() => setDialog({ type: 'details', property })} className="group flex items-start gap-3 text-left">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Building className="size-5" /></span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-slate-900 group-hover:underline">{property.name}</span>
                    <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-400"><MapPin className="size-3 shrink-0" />{[property.address, property.location].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>

                <dl className="mt-5 grid grid-cols-3 gap-3 rounded-xl bg-slate-50/80 p-3 text-center">
                  <Stat label="Houses" value={String(own.length)} />
                  <Stat label="Occupied" value={`${percent(occupied, own.length)}%`} />
                  <Stat label="Vacant" value={String(own.filter((house) => house.status === 'VACANT').length)} />
                </dl>
                <p className="mt-3 text-xs text-slate-500">Monthly rent from tenants <span className="font-semibold text-slate-800">{formatKsh(rentRoll)}</span></p>

                <div className="mt-5 flex gap-2 border-t border-slate-100 pt-4">
                  <Button variant="outline" onClick={() => setDialog({ type: 'details', property })} className={`${rowButton} flex-1`}>View</Button>
                  <Button variant="outline" onClick={() => setDialog({ type: 'form', property })} aria-label={`Edit ${property.name}`} className={rowButton}><Pencil /></Button>
                  <Button variant="outline" onClick={() => setDialog({ type: 'details', property, deleting: true })} aria-label={`Delete ${property.name}`} className="h-9 border-slate-300 bg-white px-3 text-rose-600 hover:bg-rose-50 hover:text-rose-700"><Trash2 /></Button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {dialog?.type === 'form' && (
        <PropertyFormDialog
          property={dialog.property}
          onSave={async (details) => { if (dialog.property) await updateProperty(dialog.property, details); else await createProperty(details) }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'details' && (
        <PropertyDetailsDialog
          key={dialog.property.id}
          property={dialog.property}
          houses={housesByProperty.get(dialog.property.id) ?? []}
          startInDeleteMode={dialog.deleting}
          onEdit={() => setDialog({ type: 'form', property: dialog.property })}
          onDelete={() => deleteProperty(dialog.property)}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-slate-400">{label}</dt>
      <dd className="mt-0.5 font-semibold text-slate-900">{value}</dd>
    </div>
  )
}
