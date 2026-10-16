'use client'

import { useMemo, useState } from 'react'
import { CalendarClock, KeyRound, LogOut, Pencil, Plus, Search, UserPlus } from 'lucide-react'
import { errorMessage } from '@/components/dialog'
import { FilterChip } from '@/components/filter-chip'
import { MoveOutDialog } from '@/components/move-out/move-out-dialog'
import { MoveOutsPanel, type MoveOutAction } from '@/components/move-out/move-outs-panel'
import { NoticeDialog } from '@/components/move-out/notice-dialog'
import { SettleDepositDialog } from '@/components/move-out/settlement-form'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format'
import { formatKsh, houseStatuses, statusMeta, useHouses, type House, type HouseStatus } from '@/lib/houses'
import { useMoveOuts } from '@/lib/move-out'
import { cn } from '@/lib/utils'
import { AssignTenantDialog } from './assign-tenant-dialog'
import { HouseFormDialog } from './house-form-dialog'
import { PropertyFormDialog } from '@/components/properties/property-form-dialog'
import { useProperties } from '@/lib/properties'
import { usePropertyScope } from '@/lib/property-scope'

type OpenDialog = { type: 'details'; house: House | null; propertyId?: string } | { type: 'new-property' } | { type: 'assign'; house: House } | MoveOutAction | null

// These follow the tenancy (move-in, notice, vacate), so they can't be picked by hand.
const TENANCY_STATUSES: HouseStatus[] = ['OCCUPIED', 'NOTICE_GIVEN']
const rowButton = 'h-9 border-slate-300 bg-white px-3 text-slate-700 hover:bg-slate-100'

export function HouseManagement() {
  const { houses, mode, saveHouse, changeStatus, assignTenant } = useHouses()
  const { currentFor, ready: tenanciesReady } = useMoveOuts()
  const { properties, mode: propertiesMode, error: propertiesError, createProperty } = useProperties()
  const [statusFilter, setStatusFilter] = useState<HouseStatus | 'ALL'>('ALL')
  const [query, setQuery] = useState('')
  const [dialog, setDialog] = useState<OpenDialog>(null)
  const [statusError, setStatusError] = useState<string | null>(null)

  const propertyNames = useMemo(() => new Map(properties.map((property) => [property.id, property.name])), [properties])
  // The sidebar switcher picks the property; with "All properties" each row says which one it's in.
  const { current: currentProperty } = usePropertyScope()
  const showProperty = !currentProperty && properties.length > 1

  const counts = useMemo(() => {
    const byStatus = new Map<HouseStatus, number>()
    houses.forEach((house) => byStatus.set(house.status, (byStatus.get(house.status) ?? 0) + 1))
    return byStatus
  }, [houses])

  const visibleHouses = useMemo(() => {
    const term = query.trim().toLowerCase()
    return houses.filter((house) =>
      (statusFilter === 'ALL' || house.status === statusFilter) &&
      (!term || [house.unitNumber, house.houseType, house.tenant?.name ?? ''].some((value) => value.toLowerCase().includes(term))))
  }, [houses, statusFilter, query])

  // Houses belong to a property, so with none yet the landlord creates one first and carries on.
  function addHouse() {
    setStatusError(null)
    if (propertiesMode === 'error') return setStatusError(`Properties couldn't be loaded, so no house can be added: ${propertiesError?.message ?? 'unknown error'}`)
    if (!properties.length) return setDialog({ type: 'new-property' })
    setDialog({ type: 'details', house: null, propertyId: currentProperty?.id })
  }

  async function updateStatus(house: House, status: HouseStatus) {
    setStatusError(null)
    try {
      await changeStatus(house, status)
    } catch (error) {
      setStatusError(`Couldn't update ${house.unitNumber}: ${errorMessage(error)}`)
    }
  }

  return (
    <>
      <MoveOutsPanel onAction={setDialog} />
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.03)]">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="relative flex-1 sm:max-w-xs">
              <span className="sr-only">Search houses</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search unit, type or tenant" className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-slate-950" />
            </label>
            <Button onClick={addHouse} disabled={propertiesMode === 'loading'} className="h-10 bg-slate-950 px-4 text-white hover:bg-slate-800">
              <Plus data-icon="inline-start" />Add house
            </Button>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
            <FilterChip active={statusFilter === 'ALL'} onClick={() => setStatusFilter('ALL')} label="All" count={houses.length} />
            {houseStatuses.map(({ value, label, tone }) => (
              <FilterChip key={value} active={statusFilter === value} onClick={() => setStatusFilter(value)} label={label} count={counts.get(value) ?? 0} dotClass={tone} />
            ))}
          </div>
        </div>

        {statusError && <p role="alert" className="border-b border-rose-100 bg-rose-50 px-5 py-3 text-sm text-rose-700">{statusError}</p>}

        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[820px] whitespace-nowrap text-left text-sm">
            <thead className="bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">House</th>
                <th className="px-5 py-3 font-medium">Tenant</th>
                <th className="px-5 py-3 font-medium">Rent</th>
                <th className="px-5 py-3 font-medium">Meters</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleHouses.map((house) => {
                const tenancy = house.tenant ? currentFor(house.id) : undefined
                return (
                  <tr key={house.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">{house.unitNumber}</p>
                      <p className="text-xs text-slate-400">{house.houseType || 'Type not set'}{showProperty && ` · ${propertyNames.get(house.propertyId) ?? 'Unknown property'}`}</p>
                    </td>
                    <td className="px-5 py-4">
                      {house.tenant ? (
                        <>
                          <p className="font-medium text-slate-800">{house.tenant.name}</p>
                          {tenancy?.noticeDate
                            ? <p className="flex items-center gap-1 text-xs font-medium text-amber-700"><CalendarClock className="size-3.5" />Leaving {tenancy.expectedEndDate ? formatDate(tenancy.expectedEndDate) : 'soon'}</p>
                            : house.tenant.phone && <p className="text-xs text-slate-400">{house.tenant.phone}</p>}
                        </>
                      ) : <span className="text-slate-400">No tenant</span>}
                    </td>
                    <td className="px-5 py-4 text-slate-700">{formatKsh(house.defaultMonthlyRent)}</td>
                    <td className="px-5 py-4 text-xs text-slate-500">
                      <p>Water: {house.waterMeterNumber || '—'}</p>
                      <p>Power: {house.electricityMeterNumber || '—'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <StatusSelect house={house} onChange={(status) => updateStatus(house, status)} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setDialog({ type: 'details', house })} className={rowButton}>
                          <Pencil data-icon="inline-start" />Edit
                        </Button>
                        {house.tenant ? (
                          <>
                            <Button variant="outline" disabled={!tenancy} title={tenancy ? undefined : tenanciesReady ? 'This tenancy couldn’t be found' : 'Loading tenancy…'} onClick={() => tenancy && setDialog({ type: 'notice', account: tenancy })} className={rowButton}>
                              <CalendarClock data-icon="inline-start" />{tenancy?.noticeDate ? 'Edit notice' : 'Give notice'}
                            </Button>
                            <Button variant="outline" disabled={!tenancy} onClick={() => tenancy && setDialog({ type: 'move-out', account: tenancy })} className={rowButton}>
                              <LogOut data-icon="inline-start" />Move out
                            </Button>
                          </>
                        ) : house.status === 'MAINTENANCE' || house.status === 'INACTIVE' ? (
                          <Button variant="outline" onClick={() => updateStatus(house, 'VACANT')} className={rowButton}>
                            <KeyRound data-icon="inline-start" />Mark vacant
                          </Button>
                        ) : (
                          <Button variant="outline" onClick={() => setDialog({ type: 'assign', house })} className={rowButton}>
                            <UserPlus data-icon="inline-start" />Assign tenant
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!visibleHouses.length && (
            <p className="px-5 py-12 text-center text-sm text-slate-400">
              {mode === 'loading' ? 'Loading houses…' : houses.length ? 'No houses match your filters.' : propertiesMode !== 'loading' && !properties.length ? 'No properties yet. Click “Add house” to create your first property, then its houses.' : 'No houses yet. Add your first house to get started.'}
            </p>
          )}
        </div>

        {dialog?.type === 'details' && <HouseFormDialog house={dialog.house} properties={properties} defaultPropertyId={dialog.propertyId} onSave={(details, propertyId) => saveHouse(dialog.house, details, propertyId)} onClose={() => setDialog(null)} />}
        {dialog?.type === 'new-property' && (
          <PropertyFormDialog
            property={null}
            description="Houses belong to a property. Create your first one, then you’ll go straight on to adding the house."
            onSave={async (details) => {
              const created = await createProperty(details)
              // Deferred so it runs after the property form's onClose, which would otherwise clear it.
              setTimeout(() => setDialog({ type: 'details', house: null, propertyId: created.id }))
            }}
            onClose={() => setDialog((current) => (current?.type === 'new-property' ? null : current))}
          />
        )}
        {dialog?.type === 'assign' && <AssignTenantDialog house={dialog.house} onAssign={(assignment) => assignTenant(dialog.house, assignment)} onClose={() => setDialog(null)} />}
        {dialog?.type === 'notice' && <NoticeDialog account={dialog.account} onClose={() => setDialog(null)} />}
        {dialog?.type === 'move-out' && <MoveOutDialog account={dialog.account} onClose={() => setDialog(null)} />}
        {dialog?.type === 'settle' && <SettleDepositDialog account={dialog.account} onClose={() => setDialog(null)} />}
      </section>
    </>
  )
}

function StatusSelect({ house, onChange }: { house: House; onChange: (status: HouseStatus) => void }) {
  const tone = statusMeta(house.status).tone
  if (house.tenant) {
    return <span title="Changes when the tenant gives notice or moves out" className={cn('rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset', tone)}>{statusMeta(house.status).label}</span>
  }
  return (
    <select
      aria-label={`Status of ${house.unitNumber}`}
      value={house.status}
      onChange={(event) => onChange(event.target.value as HouseStatus)}
      className={cn('cursor-pointer rounded-full border-0 py-1 pl-3 pr-7 text-xs font-semibold outline-none ring-1 ring-inset focus-visible:ring-2', tone)}
    >
      {houseStatuses.filter(({ value }) => !TENANCY_STATUSES.includes(value) || value === house.status).map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
    </select>
  )
}
