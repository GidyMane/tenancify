'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import { api, ApiError, type ApiHouse, type HouseStatus } from '@/lib/api/client'
import { useBilling } from '@/lib/billing'
import { demoHouses } from '@/lib/demo-data'
import { emptyTenantDetails, useTenants } from '@/lib/tenants'

export type { HouseStatus }

export type House = {
  id: string
  propertyId: string
  unitNumber: string
  houseType: string
  waterMeterNumber: string
  electricityMeterNumber: string
  defaultMonthlyRent: number
  defaultDepositAmount: number
  notes: string
  status: HouseStatus
  tenant: { name: string; phone?: string } | null
  metadata: Record<string, unknown>
}

export type HouseDetails = Pick<House, 'unitNumber' | 'houseType' | 'waterMeterNumber' | 'electricityMeterNumber' | 'defaultMonthlyRent' | 'defaultDepositAmount' | 'notes'>

export type Assignment = {
  tenant: { kind: 'existing'; tenantId: string } | { kind: 'new'; fullName: string; phone: string }
  monthlyRent: number
  depositRequired: number
  startDate: string
  openingWaterReading?: number
}


export const houseStatuses: { value: HouseStatus; label: string; tone: string }[] = [
  { value: 'VACANT', label: 'Vacant', tone: 'bg-sky-50 text-sky-700 ring-sky-200' },
  { value: 'OCCUPIED', label: 'Occupied', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  { value: 'RESERVED', label: 'Reserved', tone: 'bg-violet-50 text-violet-700 ring-violet-200' },
  { value: 'NOTICE_GIVEN', label: 'Notice given', tone: 'bg-amber-50 text-amber-700 ring-amber-200' },
  { value: 'MAINTENANCE', label: 'Maintenance', tone: 'bg-orange-50 text-orange-700 ring-orange-200' },
  { value: 'INACTIVE', label: 'Inactive', tone: 'bg-slate-100 text-slate-600 ring-slate-200' },
]

export const statusMeta = (status: HouseStatus) => houseStatuses.find((item) => item.value === status) ?? houseStatuses[0]

export { formatKsh } from '@/lib/format'

// The API has no electricity-meter column; existing records keep the prepaid token meter in JSON metadata under this key.
const TOKEN_METER_KEY = 'token-meter-number'
function parseMetadata(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try { return parseMetadata(JSON.parse(value)) } catch { return {} }
  }
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function toHouse(house: ApiHouse): House {
  const metadata = parseMetadata(house.metadata)
  const rent = Number(house.defaultMonthlyRent) || 0
  // The list endpoint returns every tenancy without its status; the latest one is the occupant.
  const latest = house.tenancies?.at(-1)?.tenant
  const occupied = house.status === 'OCCUPIED' || house.status === 'NOTICE_GIVEN'
  return {
    id: house.id,
    propertyId: house.propertyId,
    unitNumber: house.unitNumber,
    houseType: house.houseType ?? '',
    waterMeterNumber: house.waterMeterNumber ?? '',
    electricityMeterNumber: String(metadata[TOKEN_METER_KEY] ?? metadata.electricityMeterNumber ?? ''),
    defaultMonthlyRent: rent,
    defaultDepositAmount: Number(house.defaultDepositAmount ?? rent) || 0,
    notes: house.notes ?? '',
    status: house.status,
    tenant: occupied && latest ? { name: latest.fullName, phone: latest.phone } : null,
    metadata,
  }
}

function toPayload(details: HouseDetails, metadata: Record<string, unknown>) {
  return {
    unitNumber: details.unitNumber.trim(),
    houseType: details.houseType.trim(),
    waterMeterNumber: details.waterMeterNumber.trim(),
    defaultMonthlyRent: details.defaultMonthlyRent,
    defaultDepositAmount: details.defaultDepositAmount > 0 ? details.defaultDepositAmount : undefined,
    notes: details.notes.trim(),
    metadata: JSON.stringify({ ...metadata, [TOKEN_METER_KEY]: details.electricityMeterNumber.trim() }),
  }
}

const notFoundAsNull = (error: unknown) => {
  if (error instanceof ApiError && error.status === 404) return null
  throw error
}

/** Houses from the API, falling back to editable demo data when the API is unreachable. */
export function useHouses() {
  const live = useSWR('houses', () => api.houses())
  const demo = useSWR<House[]>('demo-houses', null, { fallbackData: demoHouses })
  const { data: properties } = useSWR('properties', api.properties)
  const { tenants, mode: tenantsMode, createTenant } = useTenants()
  const billing = useBilling()

  const mode: 'live' | 'demo' | 'loading' = live.data ? 'live' : live.error ? 'demo' : 'loading'
  const houses = useMemo(() => (live.data ? live.data.map(toHouse) : live.error ? demo.data ?? [] : []), [live.data, live.error, demo.data])

  const updateDemo = (houseId: string, change: Partial<House>) =>
    demo.mutate((current = demoHouses) => current.map((house) => (house.id === houseId ? { ...house, ...change } : house)), { revalidate: false })

  async function saveHouse(house: House | null, details: HouseDetails) {
    if (mode === 'live') {
      const payload = toPayload(details, house?.metadata ?? {})
      if (house) {
        await api.updateHouse(house.id, payload)
      } else {
        const propertyId = properties?.[0]?.id
        if (!propertyId) throw new Error('Create a property before adding houses.')
        await api.createHouse({ ...payload, propertyId })
      }
      await live.mutate()
    } else if (house) {
      await updateDemo(house.id, details)
    } else {
      // New houses always start vacant, matching the API.
      const created: House = { ...details, id: `demo-${Date.now()}`, propertyId: 'demo-property', status: 'VACANT', tenant: null, metadata: {} }
      await demo.mutate((current = demoHouses) => [...current, created], { revalidate: false })
    }
  }

  async function changeStatus(house: House, status: HouseStatus) {
    if (mode === 'live') {
      await api.changeHouseStatus(house.id, status)
      await live.mutate()
    } else {
      await updateDemo(house.id, { status })
    }
  }

  // Moves out the current occupant (if any), then moves the new tenant in.
  async function assignTenant(house: House, assignment: Assignment) {
    const { tenant } = assignment
    if (mode === 'live' && tenantsMode !== 'live') throw new Error("Tenants couldn't be loaded from the API, so no one can be assigned right now.")
    const chosen = tenant.kind === 'existing'
      ? tenants.find((item) => item.id === tenant.tenantId)
      : await createTenant({ ...emptyTenantDetails, fullName: tenant.fullName, phone: tenant.phone })
    if (!chosen) throw new Error('Choose a tenant to assign.')

    if (mode === 'live') {
      const current = await api.activeTenancy(house.id).catch(notFoundAsNull)
      if (current) await api.moveOut(current.id, { actualEndDate: assignment.startDate })
      await api.moveIn({ houseId: house.id, tenantId: chosen.id, monthlyRent: assignment.monthlyRent, depositRequired: assignment.depositRequired, startDate: assignment.startDate, openingWaterReading: assignment.openingWaterReading })
      await live.mutate()
      await billing.moveIn({ houseId: house.id, unitNumber: house.unitNumber, tenantId: chosen.id, tenantName: chosen.fullName, tenantPhone: chosen.phone, monthlyRent: assignment.monthlyRent, depositRequired: assignment.depositRequired, startDate: assignment.startDate })
    } else {
      await updateDemo(house.id, { status: 'OCCUPIED', tenant: { name: chosen.fullName, phone: chosen.phone } })
      // Mirror the API's move-in: close the old tenancy, open the new one with its deposit charge.
      await billing.moveIn({ houseId: house.id, unitNumber: house.unitNumber, tenantId: chosen.id, tenantName: chosen.fullName, tenantPhone: chosen.phone, monthlyRent: assignment.monthlyRent, depositRequired: assignment.depositRequired, startDate: assignment.startDate })
    }
  }

  return { houses, mode, saveHouse, changeStatus, assignTenant }
}

/** Active tenants who are not currently housed, for the assignment picker. */
export function useAvailableTenants() {
  const { houses } = useHouses()
  const { tenants, error } = useTenants()
  const housed = new Set(houses.flatMap((house) => (house.tenant ? [house.tenant.name] : [])))
  const options = tenants.filter((tenant) => tenant.status === 'ACTIVE' && !housed.has(tenant.fullName))
  return { options, error }
}
