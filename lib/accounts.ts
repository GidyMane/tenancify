'use client'

import { useMemo } from 'react'
import { useBilling, type Tenancy } from '@/lib/billing'
import { useHouses } from '@/lib/houses'
import { useTenants } from '@/lib/tenants'

/** A tenancy shown with the tenant's and house's current details (names can change after move-in). */
export type Account = Tenancy

/** Billing plus tenancies joined to live tenant and house records. */
export function useAccounts() {
  const billing = useBilling()
  const { tenants } = useTenants()
  const { houses } = useHouses()

  const accounts = useMemo(() => {
    const tenantsById = new Map(tenants.map((tenant) => [tenant.id, tenant]))
    const housesById = new Map(houses.map((house) => [house.id, house]))
    return billing.state.tenancies.map((tenancy): Account => {
      const tenant = tenantsById.get(tenancy.tenantId)
      return {
        ...tenancy,
        tenantName: tenant?.fullName ?? tenancy.tenantName,
        tenantPhone: tenant?.phone ?? tenancy.tenantPhone,
        unitNumber: housesById.get(tenancy.houseId)?.unitNumber ?? tenancy.unitNumber,
      }
    }).sort((a, b) => a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true }) || a.startDate.localeCompare(b.startDate))
  }, [billing.state.tenancies, tenants, houses])

  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts])
  const activeAccounts = useMemo(() => accounts.filter((account) => account.status === 'ACTIVE'), [accounts])

  return { ...billing, accounts, activeAccounts, accountById }
}
