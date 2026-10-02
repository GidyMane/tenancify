'use client'

import useSWR from 'swr'
import { api } from '@/lib/api/client'

export type DataSource = 'api' | 'demo' | 'loading'

/**
 * Decides once for the whole app whether to use the API or demo data.
 * The houses list needs no sign-in, so it doubles as the reachability probe
 * (it shares the 'houses' cache entry with useHouses, so it costs no extra request).
 * When the API is reachable every module uses it — an auth failure is shown as an error,
 * never silently replaced with demo data.
 */
export function useDataSource(): DataSource {
  const { data, error } = useSWR('houses', () => api.houses())
  return data ? 'api' : error ? 'demo' : 'loading'
}
