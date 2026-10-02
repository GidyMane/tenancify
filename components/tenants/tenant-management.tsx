'use client'

import { useMemo, useState } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { FilterChip } from '@/components/filter-chip'
import { Button } from '@/components/ui/button'
import { useHouses, type House } from '@/lib/houses'
import { tenantStatuses, tenantStatusMeta, useTenants, type Tenant, type TenantStatus } from '@/lib/tenants'
import { cn } from '@/lib/utils'
import { TenantDetailsDialog } from './tenant-details-dialog'
import { TenantFormDialog } from './tenant-form-dialog'

type OpenDialog = { type: 'form'; tenant: Tenant | null } | { type: 'details'; tenant: Tenant; deleting?: boolean } | null

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()

export function TenantManagement() {
  const { tenants, mode, createTenant, updateTenant, deleteTenant } = useTenants()
  const { houses } = useHouses()
  const [statusFilter, setStatusFilter] = useState<TenantStatus | 'ALL'>('ALL')
  const [query, setQuery] = useState('')
  const [dialog, setDialog] = useState<OpenDialog>(null)

  // Houses only expose their occupant's name, so tenants are linked to houses by name.
  const houseByTenant = useMemo(() => new Map<string, House>(houses.flatMap((house) => (house.tenant ? [[house.tenant.name, house]] : []))), [houses])

  const visibleTenants = useMemo(() => {
    const term = query.trim().toLowerCase()
    return tenants.filter((tenant) =>
      (statusFilter === 'ALL' || tenant.status === statusFilter) &&
      (!term || [tenant.fullName, tenant.phone, tenant.email, tenant.nationalId, houseByTenant.get(tenant.fullName)?.unitNumber ?? ''].some((value) => value.toLowerCase().includes(term))))
  }, [tenants, statusFilter, query, houseByTenant])

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.03)]">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative flex-1 sm:max-w-xs">
            <span className="sr-only">Search tenants</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, phone, ID or house" className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-slate-950" />
          </label>
          <Button onClick={() => setDialog({ type: 'form', tenant: null })} className="h-10 bg-slate-950 px-4 text-white hover:bg-slate-800">
            <Plus data-icon="inline-start" />Add tenant
          </Button>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          <FilterChip active={statusFilter === 'ALL'} onClick={() => setStatusFilter('ALL')} label="All" count={tenants.length} />
          {tenantStatuses.map(({ value, label, tone }) => (
            <FilterChip key={value} active={statusFilter === value} onClick={() => setStatusFilter(value)} label={label} count={tenants.filter((tenant) => tenant.status === value).length} dotClass={tone} />
          ))}
        </div>
      </div>

      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[860px] whitespace-nowrap text-left text-sm">
          <thead className="bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Tenant</th>
              <th className="px-5 py-3 font-medium">Contact</th>
              <th className="px-5 py-3 font-medium">House</th>
              <th className="px-5 py-3 font-medium">Emergency contact</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleTenants.map((tenant) => {
              const house = houseByTenant.get(tenant.fullName)
              const status = tenantStatusMeta(tenant.status)
              return (
                <tr key={tenant.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-4">
                    <button type="button" onClick={() => setDialog({ type: 'details', tenant })} className="group flex items-center gap-3 text-left">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">{initials(tenant.fullName)}</span>
                      <span>
                        <span className="block font-semibold text-slate-900 group-hover:underline">{tenant.fullName}</span>
                        <span className="block text-xs text-slate-400">{tenant.nationalId ? `ID ${tenant.nationalId}` : 'No ID recorded'}</span>
                      </span>
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-slate-700">{tenant.phone}</p>
                    <p className="text-xs text-slate-400">{tenant.email || 'No email'}</p>
                  </td>
                  <td className="px-5 py-4">{house ? <span className="font-medium text-slate-800">{house.unitNumber}</span> : <span className="text-slate-400">—</span>}</td>
                  <td className="px-5 py-4">
                    {tenant.emergencyContactName ? (
                      <>
                        <p className="text-slate-700">{tenant.emergencyContactName}</p>
                        <p className="text-xs text-slate-400">{tenant.emergencyContactPhone}</p>
                      </>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-5 py-4"><span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', status.tone)}>{status.label}</span></td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setDialog({ type: 'details', tenant })} className="h-9 border-slate-300 bg-white px-3 text-slate-700 hover:bg-slate-100">View</Button>
                      <Button variant="outline" onClick={() => setDialog({ type: 'form', tenant })} aria-label={`Edit ${tenant.fullName}`} className="h-9 border-slate-300 bg-white px-2.5 text-slate-700 hover:bg-slate-100">
                        <Pencil />
                      </Button>
                      <Button variant="outline" onClick={() => setDialog({ type: 'details', tenant, deleting: true })} aria-label={`Delete ${tenant.fullName}`} className="h-9 border-slate-300 bg-white px-2.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700">
                        <Trash2 />
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!visibleTenants.length && (
          <p className="px-5 py-12 text-center text-sm text-slate-400">
            {mode === 'loading' ? 'Loading tenants…' : tenants.length ? 'No tenants match your filters.' : 'No tenants yet. Add your first tenant to get started.'}
          </p>
        )}
      </div>

      {dialog?.type === 'form' && (
        <TenantFormDialog
          tenant={dialog.tenant}
          onSave={async (details) => { if (dialog.tenant) await updateTenant(dialog.tenant, details); else await createTenant(details) }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'details' && (
        <TenantDetailsDialog
          key={dialog.tenant.id}
          tenant={dialog.tenant}
          house={houseByTenant.get(dialog.tenant.fullName)}
          startInDeleteMode={dialog.deleting}
          onEdit={() => setDialog({ type: 'form', tenant: dialog.tenant })}
          onDelete={() => deleteTenant(dialog.tenant)}
          onClose={() => setDialog(null)}
        />
      )}
    </section>
  )
}
