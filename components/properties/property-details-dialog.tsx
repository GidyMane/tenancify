'use client'

import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Dialog, FormError, errorMessage, inputClass } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { formatDate, formatKsh } from '@/lib/format'
import { statusMeta, type House } from '@/lib/houses'
import { useProperty, type Property } from '@/lib/properties'
import { cn } from '@/lib/utils'

type Props = {
  property: Property
  houses: House[]
  startInDeleteMode?: boolean
  onEdit: () => void
  onDelete: () => Promise<void>
  onClose: () => void
}

export function PropertyDetailsDialog({ property: listed, houses, startInDeleteMode = false, onEdit, onDelete, onClose }: Props) {
  const { property, error: loadError, loading } = useProperty(listed)
  const [confirmingDelete, setConfirmingDelete] = useState(startInDeleteMode)
  const [typedName, setTypedName] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const occupied = houses.filter((house) => house.tenant)

  async function confirmDelete() {
    setDeleting(true)
    setError(null)
    try {
      await onDelete()
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setDeleting(false)
    }
  }

  return (
    <Dialog eyebrow="Property" title={property.name} description={[property.address, property.location].filter(Boolean).join(' · ')} onClose={onClose}>
      {loadError && <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">Showing the saved list copy. The latest details couldn’t be loaded: {loadError.message}</p>}

      <dl className={cn('mt-6 grid gap-x-6 gap-y-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-5 text-sm sm:grid-cols-2', loading && 'opacity-60')}>
        <Detail label="Address" value={property.address} />
        <Detail label="Location" value={property.location} />
        <Detail label="Water rate" value={`${property.currency} ${property.defaultWaterRate.toLocaleString('en-KE')} per unit`} />
        <Detail label="Notice period" value={`${property.defaultNoticePeriodDays} days`} />
        <Detail label="Owner" value={property.ownerName ?? ''} />
        <Detail label="Added" value={property.createdAt ? formatDate(property.createdAt.slice(0, 10)) : ''} />
        {property.description && <div className="sm:col-span-2"><Detail label="Description" value={property.description} /></div>}
      </dl>

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Houses · {houses.length}</p>
        {houses.length ? (
          <ul className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-100">
            {houses.map((house) => {
              const status = statusMeta(house.status)
              return (
                <li key={house.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{house.unitNumber} <span className="font-normal text-slate-400">· {house.houseType || 'Type not set'}</span></p>
                    <p className="truncate text-xs text-slate-400">{house.tenant?.name ?? 'No tenant'} · {formatKsh(house.defaultMonthlyRent)}</p>
                  </div>
                  <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', status.tone)}>{status.label}</span>
                </li>
              )
            })}
          </ul>
        ) : <p className="mt-3 rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">No houses yet. Add them from the Houses page.</p>}
      </div>

      {confirmingDelete ? (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4">
          {occupied.length ? (
            <p className="text-sm text-rose-800">
              <span className="font-semibold">{occupied.length} {occupied.length === 1 ? 'house is' : 'houses are'} still occupied.</span> Move every tenant out before deleting {property.name}.
            </p>
          ) : (
            <>
              <p className="text-sm text-rose-800">
                <span className="font-semibold">Delete {property.name}?</span> This also deletes its {houses.length} {houses.length === 1 ? 'house' : 'houses'} and cannot be undone. It only works when none of them has ever had a tenant.
              </p>
              <label className="mt-4 flex flex-col gap-2 text-sm font-medium text-rose-900">
                Type the property name to confirm
                <input value={typedName} onChange={(event) => setTypedName(event.target.value)} placeholder={property.name} className={inputClass} />
              </label>
            </>
          )}
          <div className="mt-4"><FormError message={error} /></div>
          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setConfirmingDelete(false)} className="h-10 border-slate-300 bg-white px-4 text-slate-700 hover:bg-slate-100">Keep property</Button>
            {!occupied.length && <Button type="button" disabled={deleting || typedName.trim() !== property.name.trim()} onClick={confirmDelete} className="h-10 bg-rose-600 px-4 text-white hover:bg-rose-700">{deleting ? 'Deleting…' : 'Delete property'}</Button>}
          </div>
        </div>
      ) : (
        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" onClick={() => setConfirmingDelete(true)} className="h-10 border-rose-200 bg-white px-4 text-rose-600 hover:bg-rose-50 hover:text-rose-700">
            <Trash2 data-icon="inline-start" />Delete
          </Button>
          <Button type="button" onClick={onEdit} className="h-10 bg-slate-950 px-4 text-white hover:bg-slate-800">
            <Pencil data-icon="inline-start" />Edit details
          </Button>
        </div>
      )}
    </Dialog>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className={cn('mt-0.5 break-words font-medium', value ? 'text-slate-800' : 'text-slate-300')}>{value || 'Not recorded'}</dd>
    </div>
  )
}
