'use client'

import { useEffect } from 'react'
import useSWR from 'swr'
import { useProperties } from '@/lib/properties'

export const ALL_PROPERTIES = 'all'

// Which property the workspace is showing. Kept in this browser so a refresh lands on the same one.
const STORAGE_KEY = 'rentwise-property-scope'
let restored = false

/** The property chosen in the sidebar switcher, or ALL_PROPERTIES. A deleted property falls back to all. */
export function usePropertyScope() {
  const { properties } = useProperties()
  const { data: stored = ALL_PROPERTIES, mutate } = useSWR<string>('property-scope', null, { fallbackData: ALL_PROPERTIES })

  useEffect(() => {
    if (restored) return
    restored = true
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved) mutate(saved, { revalidate: false })
    } catch { /* Storage can be blocked; the switcher then starts on all properties. */ }
  }, [mutate])

  const current = properties.find((property) => property.id === stored) ?? null
  const scopeId = current ? current.id : ALL_PROPERTIES

  const setScope = (id: string) => {
    try { window.localStorage.setItem(STORAGE_KEY, id) } catch { /* Lasts for this visit only. */ }
    return mutate(id, { revalidate: false })
  }

  /** True when a house with this propertyId belongs in the current view. */
  const inScope = (propertyId: string) => scopeId === ALL_PROPERTIES || propertyId === scopeId

  return { properties, current, scopeId, setScope, inScope }
}
