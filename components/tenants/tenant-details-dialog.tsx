'use client'

import { useState } from 'react'
import { Home, Pencil, Trash2 } from 'lucide-react'
import { Dialog, FormError, errorMessage } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import type { House } from '@/lib/houses'
import { tenantStatusMeta, type Tenant } from '@/lib/tenants'
import { cn } from '@/lib/utils'

type Props = {
  tenant: Tenant
  house: House | undefined
  startInDeleteMode?: boolean
  onEdit: () => void
  onDelete: () => Promise<void>
  onClose: () => void
}

export function TenantDetailsDialog({ tenant, house, startInDeleteMode = false, onEdit, onDelete, onClose }: Props) {
  const [confirmingDelete, setConfirmingDelete] = useState(startInDeleteMode)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const status = tenantStatusMeta(tenant.status)

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
    <Dialog eyebrow="Tenant profile" title={tenant.fullName} description={tenant.occupation || 'Occupation not recorded'} onClose={onClose}>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', status.tone)}>{status.label}</span>
        <span className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', house ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500')}>
          <Home className="size-3.5" />{house ? `Lives in ${house.unitNumber}` : 'No house assigned'}
        </span>
      </div>

      <dl className="mt-6 grid gap-x-6 gap-y-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-5 text-sm sm:grid-cols-2">
        <Detail label="Phone" value={tenant.phone} />
        <Detail label="Alternative phone" value={tenant.altPhone} />
        <Detail label="Email" value={tenant.email} />
        <Detail label="National ID" value={tenant.nationalId} />
        <Detail label="Emergency contact" value={tenant.emergencyContactName} />
        <Detail label="Emergency phone" value={tenant.emergencyContactPhone} />
      </dl>

      {confirmingDelete ? (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4">
          {house ? (
            <p className="text-sm text-rose-800">
              <span className="font-semibold">{tenant.fullName} still lives in {house.unitNumber}.</span> Move them out from the Houses page before deleting their record.
            </p>
          ) : (
            <p className="text-sm text-rose-800"><span className="font-semibold">Delete {tenant.fullName}?</span> This permanently removes their tenant record and cannot be undone.</p>
          )}
          <div className="mt-4"><FormError message={error} /></div>
          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setConfirmingDelete(false)} className="h-10 border-slate-300 bg-white px-4 text-slate-700 hover:bg-slate-100">Keep tenant</Button>
            {!house && <Button type="button" disabled={deleting} onClick={confirmDelete} className="h-10 bg-rose-600 px-4 text-white hover:bg-rose-700">{deleting ? 'Deleting…' : 'Delete tenant'}</Button>}
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
