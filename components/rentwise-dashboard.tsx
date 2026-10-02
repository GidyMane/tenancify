'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Building2, Droplets, FileBarChart, Home, LayoutDashboard, Menu, Receipt, Users, WalletCards, X, type LucideIcon } from 'lucide-react'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { HouseManagement } from '@/components/houses/house-management'
import { PageHeader } from '@/components/page'
import { PaymentsPage } from '@/components/payments/payments-page'
import { RentCollectionPage } from '@/components/rent/rent-collection-page'
import { ReportsPage } from '@/components/reports/reports-page'
import { TenantManagement } from '@/components/tenants/tenant-management'
import { UtilitiesPage } from '@/components/utilities/utilities-page'
import { api } from '@/lib/api/client'
import { useAccounts } from '@/lib/accounts'
import { useHouses } from '@/lib/houses'
import { today } from '@/lib/format'
import { cn } from '@/lib/utils'

export type PageId = 'dashboard' | 'houses' | 'tenants' | 'rent' | 'payments' | 'utilities' | 'reports'
export type Navigate = (page: PageId) => void

const navGroups: { label: string; items: { id: PageId; label: string; icon: LucideIcon }[] }[] = [
  { label: 'Workspace', items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }, { id: 'houses', label: 'Houses', icon: Building2 }, { id: 'tenants', label: 'Tenants', icon: Users }] },
  { label: 'Money', items: [{ id: 'rent', label: 'Rent collection', icon: WalletCards }, { id: 'payments', label: 'Payments', icon: Receipt }] },
  { label: 'Services', items: [{ id: 'utilities', label: 'Utilities', icon: Droplets }] },
  { label: 'Insights', items: [{ id: 'reports', label: 'Reports', icon: FileBarChart }] },
]
const pageIds = navGroups.flatMap((group) => group.items.map((item) => item.id))

export function RentwiseDashboard() {
  const [active, setActive] = useState<PageId>('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [greeting, setGreeting] = useState('Hello')
  const { data: properties } = useSWR('properties', api.properties)
  const { houses, mode } = useHouses()
  const { accounts, ledger } = useAccounts()
  const property = properties?.[0]
  const owing = accounts.filter((account) => ledger.arrears(account.id, today()).amount > 0).length

  // Keep the open page in the URL hash so a refresh or shared link lands on it.
  useEffect(() => {
    const fromHash = () => { const id = window.location.hash.slice(1) as PageId; if (pageIds.includes(id)) setActive(id) }
    fromHash()
    window.addEventListener('hashchange', fromHash)
    const hour = new Date().getHours()
    setGreeting(hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening')
    return () => window.removeEventListener('hashchange', fromHash)
  }, [])

  const navigate: Navigate = (page) => {
    setActive(page)
    setMobileOpen(false)
    window.history.replaceState(null, '', `#${page}`)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f7f9fc] text-slate-900">
      <aside className={cn('sidebar-scroll fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-y-auto overscroll-contain border-r border-slate-200/80 bg-white px-4 py-5 transition-transform lg:translate-x-0', mobileOpen ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-slate-950 text-white"><Home className="size-4" /></div>
            <span className="text-lg font-semibold tracking-tight">rentwise</span>
          </div>
          <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X className="size-5" /></button>
        </div>
        <div className="mt-8 flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-white text-sm font-semibold text-slate-700 shadow-sm">KP</div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{property?.name ?? 'Kilimani Properties'}</p>
            <p className="truncate text-xs text-slate-400">{houses.length} units · {property?.address ?? 'Nairobi'}</p>
          </div>
        </div>
        <nav className="mt-5 flex-1" aria-label="Main">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-6">
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{group.label}</p>
              <div className="flex flex-col gap-1">
                {group.items.map(({ id, label, icon: Icon }) => (
                  <button key={id} onClick={() => navigate(id)} aria-current={active === id ? 'page' : undefined} className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors', active === id ? 'bg-slate-950 font-medium text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900')}>
                    <Icon className="size-[17px]" />{label}
                    {id === 'rent' && owing > 0 && <span className={cn('ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold', active === id ? 'bg-white/15 text-white' : 'bg-rose-100 text-rose-600')} title={`${owing} tenants are in arrears`}>{owing}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-2">
            <div className={cn('size-2 rounded-full', mode === 'live' ? 'bg-emerald-500' : 'bg-amber-500')} />
            <p className="text-xs font-medium text-slate-700">{mode === 'live' ? 'Connected to the API' : 'Showing demo data'}</p>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">{mode === 'live' ? 'Houses and tenants are live.' : 'Changes last until you refresh.'}</p>
        </div>
      </aside>
      {mobileOpen && <button className="fixed inset-0 z-30 bg-slate-950/20 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}

      <main className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/90 px-5 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu className="size-5" /></button>
            <div>
              <p className="text-sm font-medium text-slate-900">{greeting}, Katele</p>
              <p className="hidden text-xs text-slate-400 sm:block">Here&apos;s what&apos;s happening with your property today.</p>
            </div>
          </div>
          <div className="flex size-8 items-center justify-center rounded-full bg-[#dbeafe] text-xs font-semibold text-blue-700">KO</div>
        </header>

        <div className="mx-auto max-w-[1440px] px-5 py-7 lg:px-8">
          {active === 'dashboard' && <DashboardPage navigate={navigate} />}
          {active === 'houses' && (
            <>
              <PageHeader title="Houses" description="See every house, update its details and status, and assign tenants." />
              <HouseManagement />
            </>
          )}
          {active === 'tenants' && (
            <>
              <PageHeader title="Tenants" description="Keep every tenant’s contact details in one place. Add, view, edit, or remove a tenant." />
              <TenantManagement />
            </>
          )}
          {active === 'rent' && <RentCollectionPage />}
          {active === 'payments' && <PaymentsPage />}
          {active === 'utilities' && <UtilitiesPage />}
          {active === 'reports' && <ReportsPage />}
        </div>
      </main>
    </div>
  )
}
