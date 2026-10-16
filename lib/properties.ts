'use client'

import { useMemo } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { ApiError, api, type Property as ApiProperty, type PropertyInput } from '@/lib/api/client'
import { useDataSource } from '@/lib/data-source'
import { demoHouses, demoProperties } from '@/lib/demo-data'
import type { House } from '@/lib/houses'

export type Property = {
  id: string
  name: string
  address: string
  location: string
  description: string
  defaultWaterRate: number
  currency: string
  defaultNoticePeriodDays: number
  ownerName?: string
  createdAt?: string
}

export type PropertyDetails = Pick<Property, 'name' | 'address' | 'location' | 'description' | 'defaultWaterRate' | 'currency' | 'defaultNoticePeriodDays'>

export const emptyPropertyDetails: PropertyDetails = { name: '', address: '', location: '', description: '', defaultWaterRate: 0, currency: 'KES', defaultNoticePeriodDays: 30 }

export const pickPropertyDetails = ({ name, address, location, description, defaultWaterRate, currency, defaultNoticePeriodDays }: PropertyDetails): PropertyDetails =>
  ({ name, address, location, description, defaultWaterRate, currency, defaultNoticePeriodDays })

export function toProperty(property: ApiProperty): Property {
  return {
    id: property.id,
    name: property.name,
    address: property.address,
    location: property.location ?? '',
    description: property.description ?? '',
    defaultWaterRate: Number(property.defaultWaterRate) || 0,
    currency: property.currency || 'KES',
    defaultNoticePeriodDays: property.defaultNoticePeriodDays ?? 30,
    ownerName: property.owner?.name ?? undefined,
    createdAt: property.createdAt,
  }
}

// Blank optional fields go as null so an edit can clear them.
function toPayload(details: PropertyDetails): PropertyInput {
  return {
    name: details.name.trim(),
    address: details.address.trim(),
    location: details.location.trim() || null,
    description: details.description.trim() || null,
    defaultWaterRate: details.defaultWaterRate,
    currency: details.currency.trim().toUpperCase() || 'KES',
    defaultNoticePeriodDays: details.defaultNoticePeriodDays,
  }
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Properties from the API, or editable demo data when the API is unreachable. */
export function useProperties() {
  const { mutate } = useSWRConfig()
  const source = useDataSource()
  const live = useSWR(source === 'api' ? 'properties' : null, api.properties)
  const demo = useSWR<Property[]>('demo-properties', null, { fallbackData: demoProperties })

  const mode: 'live' | 'demo' | 'error' | 'loading' = source === 'demo' ? 'demo' : live.data ? 'live' : live.error ? 'error' : 'loading'
  const properties = useMemo(() => (mode === 'live' ? live.data!.map(toProperty) : mode === 'demo' ? demo.data ?? [] : []), [mode, live.data, demo.data])
  const guard = () => { if (mode === 'error' || mode === 'loading') throw live.error ?? new Error('Properties are still loading.') }

  // The API answers every failure with a bare 500, so the one we can foresee is checked here.
  const assertUniqueName = (name: string, exceptId?: string) => {
    if (properties.some((property) => property.id !== exceptId && sameName(property.name, name))) throw new Error(`A property called “${name.trim()}” already exists. Choose another name.`)
  }

  async function createProperty(details: PropertyDetails): Promise<Property> {
    guard()
    assertUniqueName(details.name)
    if (mode === 'live') {
      const created = toProperty(await api.createProperty(toPayload(details)))
      await live.mutate()
      return created
    }
    const created: Property = { ...details, id: `demo-property-${Date.now()}`, createdAt: new Date().toISOString() }
    await demo.mutate((current = demoProperties) => [...current, created], { revalidate: false })
    return created
  }

  async function updateProperty(property: Property, details: PropertyDetails) {
    guard()
    assertUniqueName(details.name, property.id)
    if (mode === 'live') {
      await api.updateProperty(property.id, toPayload(details))
      await Promise.all([live.mutate(), mutate(['property', property.id])])
    } else {
      await demo.mutate((current = demoProperties) => current.map((item) => (item.id === property.id ? { ...item, ...details } : item)), { revalidate: false })
    }
  }

  // The API deletes the property's houses with it, so the house list is refreshed too.
  async function deleteProperty(property: Property) {
    guard()
    if (mode === 'live') {
      try {
        await api.deleteProperty(property.id)
      } catch (error) {
        if (error instanceof ApiError && error.status >= 500) throw new Error(`${property.name} couldn’t be deleted. A property can only be deleted when none of its houses has ever had a tenant.`)
        throw error
      }
      await Promise.all([live.mutate(), mutate('houses')])
    } else {
      await demo.mutate((current = demoProperties) => current.filter((item) => item.id !== property.id), { revalidate: false })
      await mutate<House[]>('demo-houses', (houses = demoHouses) => houses.filter((house) => house.propertyId !== property.id), { revalidate: false })
    }
  }

  return { properties, mode, error: live.error as Error | undefined, createProperty, updateProperty, deleteProperty }
}

/** One property, fetched fresh from GET /properties/property/:id (falls back to the list entry). */
export function useProperty(property: Property) {
  const source = useDataSource()
  const { data, error, isLoading } = useSWR(source === 'api' && !property.id.startsWith('demo-') ? ['property', property.id] : null, () => api.property(property.id))
  return { property: data ? toProperty(data) : property, error: error as Error | undefined, loading: isLoading }
}
