'use client'

import { useMemo, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Building2,
  ChevronDown,
  CircleDollarSign,
  Droplets,
  FileBarChart,
  Home,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Plus,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  Users,
  WalletCards,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Status = 'Paid' | 'Partial' | 'Unpaid'

type RentRow = {
  house: string
  tenant: string
  initials: string
  phone: string
  rent: string
  paid: string
  balance: string
  status: Status
  lastPayment: string
}

const rentRows: RentRow[] = [
  { house: 'H01', tenant: 'John Kamau', initials: 'JK', phone: '0712 445 890', rent: '15,000', paid: '15,000', balance: '0', status: 'Paid', lastPayment: 'Sep 03, 2026' },
  { house: 'H02', tenant: 'Mary Wanjiku', initials: 'MW', phone: '0722 138 421', rent: '15,000', paid: '10,000', balance: '5,000', status: 'Partial', lastPayment: 'Sep 05, 2026' },
  { house: 'H03', tenant: 'Peter Mwangi', initials: 'PM', phone: '0701 882 734', rent: '15,000', paid: '0', balance: '15,000', status: 'Unpaid', lastPayment: '—' },
  { house: 'H04', tenant: 'Jane Njeri', initials: 'JN', phone: '0798 224 117', rent: '18,000', paid: '18,000', balance: '0', status: 'Paid', lastPayment: 'Sep 01, 2026' },
  { house: 'H05', tenant: 'David Ochieng', initials: 'DO', phone: '0718 905 642', rent: '17,000', paid: '17,000', balance: '0', status: 'Paid', lastPayment: 'Sep 02, 2026' },
  { house: 'H06', tenant: 'Lucy Akinyi', initials: 'LA', phone: '0744 601 938', rent: '15,000', paid: '8,000', balance: '7,000', status: 'Partial', lastPayment: 'Sep 07, 2026' },
]

const navGroups = [
  { label: 'Workspace', items: [{ label: 'Dashboard', icon: LayoutDashboard }, { label: 'Houses', icon: Building2 }, { label: 'Tenants', icon: Users }] },
  { label: 'Operations', items: [{ label: 'Rent collection', icon: WalletCards }, { label: 'Payments', icon: Receipt }, { label: 'Arrears', icon: CircleDollarSign }, { label: 'Deposits', icon: ShieldCheck }] },
  { label: 'Utilities', items: [{ label: 'Water overview', icon: Droplets }, { label: 'Water readings', icon: Droplets }] },
  { label: 'Insights', items: [{ label: 'Reports', icon: FileBarChart }, { label: 'Settings', icon: Settings }] },
]

function StatusBadge({ status }: { status: Status }) {
  return <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', status === 'Paid' && 'bg-emerald-50 text-emerald-700', status === 'Partial' && 'bg-amber-50 text-amber-700', status === 'Unpaid' && 'bg-rose-50 text-rose-700')}><span className="size-1.5 rounded-full bg-current" />{status}</span>
}

function StatCard({ label, value, detail, icon: Icon, tone, trend }: { label: string; value: string; detail: string; icon: typeof Home; tone: string; trend?: string }) {
  return <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)]"><div className="flex items-start justify-between"><div className={cn('flex size-10 items-center justify-center rounded-xl', tone)}><Icon className="size-5" /></div>{trend && <span className="flex items-center gap-1 text-xs font-medium text-emerald-600"><ArrowUpRight className="size-3.5" />{trend}</span>}</div><p className="mt-5 text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></div>
}

export function RentwiseDashboard() {
  const [active, setActive] = useState('Dashboard')
  const [filter, setFilter] = useState<'All' | Status>('All')
  const [mobileOpen, setMobileOpen] = useState(false)
  const filteredRows = useMemo(() => filter === 'All' ? rentRows : rentRows.filter((row) => row.status === filter), [filter])

  return <div className="min-h-screen bg-[#f7f9fc] text-slate-900">
    <aside className={cn('fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200/80 bg-white px-4 py-5 transition-transform lg:translate-x-0', mobileOpen ? 'translate-x-0' : '-translate-x-full')}>
      <div className="flex items-center justify-between px-2"><div className="flex items-center gap-2.5"><div className="flex size-9 items-center justify-center rounded-xl bg-slate-950 text-white"><Home className="size-4" /></div><span className="text-lg font-semibold tracking-tight">rentwise</span></div><button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X className="size-5" /></button></div>
      <div className="mt-8 flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3"><div className="flex size-9 items-center justify-center rounded-lg bg-white text-sm font-semibold text-slate-700 shadow-sm">KP</div><div className="min-w-0"><p className="truncate text-sm font-medium">Kilimani Properties</p><p className="truncate text-xs text-slate-400">20 units · Nairobi</p></div><ChevronDown className="ml-auto size-4 text-slate-400" /></div>
      <nav className="mt-8 flex-1">{navGroups.map((group) => <div key={group.label} className="mb-6"><p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{group.label}</p><div className="flex flex-col gap-1">{group.items.map(({ label, icon: Icon }) => <button key={label} onClick={() => { setActive(label); setMobileOpen(false) }} className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors', active === label ? 'bg-slate-950 font-medium text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900')}><Icon className="size-[17px]" />{label}{label === 'Arrears' && <span className="ml-auto rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-600">4</span>}</button>)}</div></div>)}</nav>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center gap-2"><div className="size-2 rounded-full bg-emerald-500" /><p className="text-xs font-medium text-slate-700">API connected</p></div><p className="mt-1 text-[11px] text-slate-400">Last synced just now</p></div>
    </aside>
    {mobileOpen && <button className="fixed inset-0 z-30 bg-slate-950/20 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
    <main className="lg:pl-64"><header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/90 px-5 backdrop-blur lg:px-8"><div className="flex items-center gap-3"><button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu className="size-5" /></button><div><p className="text-sm font-medium text-slate-900">Good morning, Kevin</p><p className="hidden text-xs text-slate-400 sm:block">Here&apos;s what&apos;s happening with your property today.</p></div></div><div className="flex items-center gap-2"><button className="hidden items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 sm:flex"><Search className="size-4 text-slate-400" />Search <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400">⌘ K</kbd></button><button className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Notifications"><Bell className="size-[18px]" /><span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-rose-500" /></button><div className="ml-1 flex size-8 items-center justify-center rounded-full bg-[#dbeafe] text-xs font-semibold text-blue-700">KO</div></div></header>
      <div className="mx-auto max-w-[1440px] px-5 py-7 lg:px-8"><div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Overview</p><h1 className="text-2xl font-semibold tracking-tight text-slate-950">Property dashboard</h1><p className="mt-1 text-sm text-slate-500">Tuesday, September 22, 2026</p></div><div className="flex gap-2"><Button variant="outline" className="border-slate-200 bg-white"><MoreHorizontal data-icon="inline-start" />More</Button><Button className="bg-slate-950 text-white hover:bg-slate-800"><Plus data-icon="inline-start" />Record payment</Button></div></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Total houses" value="20" detail="4 available or on notice" icon={Building2} tone="bg-blue-50 text-blue-600" /><StatCard label="Occupied" value="16" detail="80% occupancy rate" icon={Home} tone="bg-emerald-50 text-emerald-600" trend="5.2%" /><StatCard label="Rent collected" value="KSh 280,000" detail="of KSh 320,000 expected" icon={WalletCards} tone="bg-violet-50 text-violet-600" trend="87.5%" /><StatCard label="Total outstanding" value="KSh 54,500" detail="Across rent and water" icon={CircleDollarSign} tone="bg-amber-50 text-amber-600" /></div>
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]"><section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)]"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-slate-900">Rent collection</p><p className="mt-1 text-xs text-slate-400">September 2026</p></div><button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600">This month <ChevronDown className="ml-1 inline size-3.5" /></button></div><div className="mt-7 flex flex-col gap-6 sm:flex-row sm:items-center"><div className="relative flex size-36 shrink-0 items-center justify-center rounded-full" style={{ background: 'conic-gradient(#111827 0 87.5%, #e8edf3 87.5% 100%)' }}><div className="flex size-28 flex-col items-center justify-center rounded-full bg-white"><span className="text-2xl font-semibold text-slate-950">87.5%</span><span className="text-[11px] text-slate-400">collected</span></div></div><div className="grid flex-1 grid-cols-3 gap-4"><div><p className="text-xs text-slate-400">Expected</p><p className="mt-1 text-base font-semibold">KSh 320k</p></div><div><p className="text-xs text-slate-400">Collected</p><p className="mt-1 text-base font-semibold text-emerald-600">KSh 280k</p></div><div><p className="text-xs text-slate-400">Outstanding</p><p className="mt-1 text-base font-semibold text-rose-600">KSh 40k</p></div><div className="col-span-3 border-t border-slate-100 pt-4"><div className="flex gap-5 text-xs"><span className="text-slate-500"><b className="text-slate-900">16</b> paid</span><span className="text-slate-500"><b className="text-amber-600">2</b> partial</span><span className="text-slate-500"><b className="text-rose-600">2</b> unpaid</span></div></div></div></div></section><section className="rounded-2xl border border-slate-200/80 bg-slate-950 p-5 text-white shadow-[0_2px_10px_rgba(15,23,42,0.08)]"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold">Occupancy overview</p><p className="mt-1 text-xs text-slate-400">Current unit status</p></div><Building2 className="size-5 text-slate-400" /></div><div className="mt-7 flex items-end gap-2"><span className="text-4xl font-semibold">80%</span><span className="mb-1 text-xs text-emerald-400">+4.8% vs last month</span></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full w-4/5 rounded-full bg-white" /></div><div className="mt-5 grid grid-cols-3 gap-3 text-xs"><div><p className="text-2xl font-semibold">16</p><p className="mt-1 text-slate-400">Occupied</p></div><div><p className="text-2xl font-semibold">3</p><p className="mt-1 text-slate-400">Vacant</p></div><div><p className="text-2xl font-semibold">1</p><p className="mt-1 text-slate-400">Notice</p></div></div></section></div>
        <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.03)]"><div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center"><div><h2 className="text-sm font-semibold">Monthly rent status</h2><p className="mt-1 text-xs text-slate-400">Track payment status for every house</p></div><div className="flex items-center gap-2 overflow-x-auto">{(['All', 'Paid', 'Partial', 'Unpaid'] as const).map((item) => <button key={item} onClick={() => setFilter(item)} className={cn('whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium', filter === item ? 'bg-slate-950 text-white' : 'text-slate-500 hover:bg-slate-50')}>{item}</button>)}</div></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-400"><tr><th className="px-5 py-3 font-medium">House</th><th className="px-5 py-3 font-medium">Tenant</th><th className="px-5 py-3 font-medium">Rent</th><th className="px-5 py-3 font-medium">Paid</th><th className="px-5 py-3 font-medium">Balance</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 font-medium">Last payment</th><th className="px-5 py-3" /></tr></thead><tbody className="divide-y divide-slate-100">{filteredRows.map((row) => <tr key={row.house} className="hover:bg-slate-50/60"><td className="px-5 py-4 font-semibold text-slate-900">{row.house}</td><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">{row.initials}</div><div><p className="font-medium text-slate-800">{row.tenant}</p><p className="text-xs text-slate-400">{row.phone}</p></div></div></td><td className="px-5 py-4 text-slate-600">KSh {row.rent}</td><td className="px-5 py-4 font-medium text-slate-700">KSh {row.paid}</td><td className={cn('px-5 py-4 font-medium', row.balance === '0' ? 'text-slate-400' : 'text-rose-600')}>{row.balance === '0' ? '—' : `KSh ${row.balance}`}</td><td className="px-5 py-4"><StatusBadge status={row.status} /></td><td className="px-5 py-4 text-xs text-slate-500">{row.lastPayment}</td><td className="px-5 py-4"><button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label={`Actions for ${row.house}`}><MoreHorizontal className="size-4" /></button></td></tr>)}</tbody></table></div><div className="flex items-center justify-between border-t border-slate-100 px-5 py-4"><p className="text-xs text-slate-400">Showing {filteredRows.length} of 20 houses</p><button className="text-xs font-medium text-slate-700 hover:text-slate-950">View all rent records <ArrowDownRight className="ml-1 inline size-3.5 rotate-[-45deg]" /></button></div></section>
        <div className="mt-6 grid gap-6 md:grid-cols-3"><section className="rounded-2xl border border-slate-200/80 bg-white p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Water balance</p><p className="mt-1 text-xs text-slate-400">September usage</p></div><Droplets className="size-5 text-cyan-500" /></div><p className="mt-6 text-2xl font-semibold">KSh 4,900</p><div className="mt-4 flex items-center justify-between text-xs"><span className="text-slate-400">Collected KSh 23,500</span><span className="font-medium text-cyan-600">82.7%</span></div><div className="mt-2 h-1.5 rounded-full bg-slate-100"><div className="h-full w-[83%] rounded-full bg-cyan-500" /></div></section><section className="rounded-2xl border border-slate-200/80 bg-white p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Deposits held</p><p className="mt-1 text-xs text-slate-400">Across active tenancies</p></div><ShieldCheck className="size-5 text-violet-500" /></div><p className="mt-6 text-2xl font-semibold">KSh 320,000</p><div className="mt-4 flex items-center gap-2 text-xs text-slate-400"><span className="size-2 rounded-full bg-violet-500" />16 fully paid <span className="ml-auto font-medium text-amber-600">2 partial</span></div></section><section className="rounded-2xl border border-slate-200/80 bg-white p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Needs attention</p><p className="mt-1 text-xs text-slate-400">Items requiring follow-up</p></div><Bell className="size-5 text-amber-500" /></div><div className="mt-5 flex flex-col gap-3 text-xs"><div className="flex items-center justify-between"><span className="text-slate-500">Unpaid rent</span><span className="font-semibold text-rose-600">2 houses</span></div><div className="flex items-center justify-between"><span className="text-slate-500">Missing water readings</span><span className="font-semibold text-amber-600">3 houses</span></div><div className="flex items-center justify-between"><span className="text-slate-500">Move-out notices</span><span className="font-semibold text-slate-700">1 house</span></div></div></section></div>
      </div></main>
  </div>
}
