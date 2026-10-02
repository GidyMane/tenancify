'use client'

import { useMemo } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { api, type ApiTenant, type TenantInput, type TenantStatus } from '@/lib/api/client'
import { demoHouses, demoTenants } from '@/lib/demo-data'
import type { House } from '@/lib/houses'

export type { TenantStatus }

export type Tenant = {
  id: string
  fullName: string
  phone: string
  altPhone: string
  nationalId: string
  email: string
  occupation: string
  emergencyContactName: string
  emergencyContactPhone: string
  status: TenantStatus
}

export type TenantDetails = Omit<Tenant, 'id' | 'status'>

export const emptyTenantDetails: TenantDetails = { fullName: '', phone: '', altPhone: '', nationalId: '', email: '', occupation: '', emergencyContactName: '', emergencyContactPhone: '' }

export const tenantStatuses: { value: TenantStatus; label: string; tone: string }[] = [
  { value: 'ACTIVE', label: 'Active', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  { value: 'FORMER', label: 'Former', tone: 'bg-slate-100 text-slate-600 ring-slate-200' },
]

export const tenantStatusMeta = (status: TenantStatus) => tenantStatuses.find((item) => item.value === status) ?? tenantStatuses[0]

export const pickTenantDetails = ({ fullName, phone, altPhone, nationalId, email, occupation, emergencyContactName, emergencyContactPhone }: TenantDetails): TenantDetails =>
  ({ fullName, phone, altPhone, nationalId, email, occupation, emergencyContactName, emergencyContactPhone })

function toTenant(tenant: ApiTenant): Tenant {
  return {
    id: tenant.id,
    fullName: tenant.fullName,
    phone: tenant.phone,
    altPhone: tenant.altPhone ?? '',
    nationalId: tenant.nationalId ?? '',
    email: tenant.email ?? '',
    occupation: tenant.occupation ?? '',
    emergencyContactName: tenant.emergencyContactName ?? '',
    emergencyContactPhone: tenant.emergencyContactPhone ?? '',
    status: tenant.status ?? 'ACTIVE',
  }
}

function toPayload(details: TenantDetails): TenantInput {
  const optional = (value: string) => value.trim() || null
  return {
    fullName: details.fullName.trim(),
    phone: details.phone.trim(),
    altPhone: optional(details.altPhone),
    nationalId: optional(details.nationalId),
    email: optional(details.email),
    occupation: optional(details.occupation),
    emergencyContactName: optional(details.emergencyContactName),
    emergencyContactPhone: optional(details.emergencyContactPhone),
  }
}

const trimmed = (details: TenantDetails) => Object.fromEntries(Object.entries(details).map(([key, value]) => [key, value.trim()])) as TenantDetails

/** Tenants from the API, falling back to editable demo data when the API is unreachable. */
export function useTenants() {
  const { mutate } = useSWRConfig()
  const live = useSWR('tenants', api.tenants)
  const demo = useSWR<Tenant[]>('demo-tenants', null, { fallbackData: demoTenants })

  const mode: 'live' | 'demo' | 'loading' = live.data ? 'live' : live.error ? 'demo' : 'loading'
  const tenants = useMemo(() => (live.data ? live.data.map(toTenant) : live.error ? demo.data ?? [] : []), [live.data, live.error, demo.data])

  async function createTenant(details: TenantDetails): Promise<Tenant> {
    if (mode === 'live') {
      const created = toTenant(await api.createTenant(toPayload(details)))
      await live.mutate()
      return created
    }
    const created: Tenant = { ...trimmed(details), id: `demo-tenant-${Date.now()}`, status: 'ACTIVE' }
    await demo.mutate((current = demoTenants) => [...current, created], { revalidate: false })
    return created
  }

  // Houses show their occupant's name and phone, so they are refreshed after a tenant edit.
  async function updateTenant(tenant: Tenant, details: TenantDetails) {
    if (mode === 'live') {
      await api.updateTenant(tenant.id, toPayload(details))
      await Promise.all([live.mutate(), mutate('houses')])
    } else {
      const updated = trimmed(details)
      await demo.mutate((current = demoTenants) => current.map((item) => (item.id === tenant.id ? { ...item, ...updated } : item)), { revalidate: false })
      await mutate<House[]>('demo-houses', (houses = demoHouses) => houses.map((house) =>
        house.tenant?.name === tenant.fullName ? { ...house, tenant: { name: updated.fullName, phone: updated.phone } } : house), { revalidate: false })
    }
  }

  async function deleteTenant(tenant: Tenant) {
    if (mode === 'live') {
      await api.deleteTenant(tenant.id)
      await live.mutate()
    } else {
      await demo.mutate((current = demoTenants) => current.filter((item) => item.id !== tenant.id), { revalidate: false })
    }
  }

  return { tenants, mode, error: live.error as Error | undefined, createTenant, updateTenant, deleteTenant }
}
