'use client'

import { useState, type ReactNode } from 'react'
import { AlertCircle, ArrowRight, Building2, CalendarPlus, CheckCircle2, CircleDollarSign, Clock, Droplets, HandCoins, Home, Plus, Receipt, Trash2, WalletCards, type LucideIcon } from 'lucide-react'
import { CollectionTrendChart } from '@/components/charts'
import { Card, PageHeader, Progress, StatCard, primaryButton } from '@/components/page'
import { RecordPaymentDialog } from '@/components/payments/record-payment-dialog'
import type { Navigate, PageId } from '@/components/rentwise-dashboard'
import { Button } from '@/components/ui/button'
import { useAccounts } from '@/lib/accounts'
import { activeIn, paymentMethods } from '@/lib/billing'
import { addMonths, currentPeriod, daysBetween, formatDate, formatKsh, initials, percent, periodLabel, periodOf, today } from '@/lib/format'
import { houseStatuses, useHouses } from '@/lib/houses'
import { cn } from '@/lib/utils'

type Task = { id: string; icon: LucideIcon; tone: string; title: string; detail: string; action: ReactNode }

export function DashboardPage({ navigate }: { navigate: Navigate }) {
  const { state, ledger, accounts, activeAccounts, accountById, generateRent, billGarbage } = useAccounts()
  const { houses } = useHouses()
  const [recording, setRecording] = useState(false)

  const period = currentPeriod()
  const lastPeriod = addMonths(period, -1)
  const now = today()

  // Rent this month
  const rent = activeAccounts.map((account) => ({ account, ...ledger.rentStatus(account.id, period) })).filter((row) => row.status !== 'NOT_BILLED')
  const expected = rent.reduce((sum, row) => sum + row.amount, 0)
  const collected = rent.reduce((sum, row) => sum + row.paid, 0)
  const unpaid = rent.filter((row) => row.status !== 'PAID')
  const rentDue = rent[0]?.charge?.dueDate ?? `${period}-${String(state.settings.rentDueDay).padStart(2, '0')}`
  const rentOverdue = now > rentDue

  // Arrears and money in
  const arrears = accounts.map((account) => ({ account, ...ledger.arrears(account.id, now) })).filter((row) => row.amount > 0)
  const arrearsTotal = arrears.reduce((sum, row) => sum + row.amount, 0)
  const oldArrears = arrears.filter((row) => row.oldestDue && daysBetween(row.oldestDue, now) > 30)
  const receivedThisMonth = state.payments.filter((payment) => !payment.voidedAt && periodOf(payment.paidAt) === period)
  const recent = [...state.payments].filter((payment) => !payment.voidedAt).sort((a, b) => b.paidAt.localeCompare(a.paidAt) || b.id.localeCompare(a.id, undefined, { numeric: true })).slice(0, 5)

  // Houses
  const occupied = houses.filter((house) => house.status === 'OCCUPIED' || house.status === 'NOTICE_GIVEN').length
  const vacant = houses.filter((house) => house.status === 'VACANT')
  const onNotice = houses.filter((house) => house.status === 'NOTICE_GIVEN')

  // Utilities
  const missingRent = activeAccounts.filter((account) => !ledger.chargeFor(account.id, 'RENT', period))
  const unreadMeters = accounts.filter((account) => activeIn(account, lastPeriod) && !ledger.readingFor(account.id, lastPeriod))
  const garbageUnbilled = activeAccounts.filter((account) => !ledger.chargeFor(account.id, 'TRASH', period))

  const trend = Array.from({ length: 6 }, (_, index) => addMonths(period, index - 5)).map((month) => {
    const totals = ledger.periodTotals(month)
    const sum = (key: 'billed' | 'collected') => Object.values(totals).reduce((total, row) => total + row[key], 0)
    return { label: periodLabel(month, 'short'), billed: sum('billed'), collected: sum('collected') }
  }).filter((point) => point.billed > 0)

  const go = (page: PageId, label: string) => <Button variant="outline" onClick={() => navigate(page)} className="h-8 border-slate-300 bg-white px-3 text-xs text-slate-700 hover:bg-slate-100">{label}<ArrowRight data-icon="inline-end" /></Button>
  const tasks: Task[] = [
    missingRent.length > 0 && { id: 'rent', icon: CalendarPlus, tone: 'bg-blue-50 text-blue-600', title: `Generate rent for ${periodLabel(period)}`, detail: `${missingRent.length} tenant${missingRent.length === 1 ? ' has' : 's have'} no rent charge this month yet.`, action: <Button onClick={() => generateRent(period)} className="h-8 bg-slate-950 px-3 text-xs text-white hover:bg-slate-800">Generate</Button> },
    unpaid.length > 0 && { id: 'unpaid', icon: rentOverdue ? AlertCircle : Clock, tone: rentOverdue ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600', title: `${unpaid.length} tenant${unpaid.length === 1 ? ' hasn’t' : 's haven’t'} paid ${periodLabel(period, 'short').split(' ')[0]} rent`, detail: `${formatKsh(expected - collected)} ${rentOverdue ? `overdue since ${formatDate(rentDue)}` : `due on ${formatDate(rentDue)}`} · ${unpaid.map((row) => row.account.unitNumber).join(', ')}`, action: go('rent', 'Collect') },
    oldArrears.length > 0 && { id: 'old', icon: HandCoins, tone: 'bg-rose-50 text-rose-600', title: `${oldArrears.length} account${oldArrears.length === 1 ? '' : 's'} over 30 days in arrears`, detail: oldArrears.map((row) => `${row.account.tenantName} ${formatKsh(row.amount)}`).join(' · '), action: go('rent', 'Follow up') },
    unreadMeters.length > 0 && { id: 'water', icon: Droplets, tone: 'bg-cyan-50 text-cyan-600', title: `Read water meters for ${periodLabel(lastPeriod)}`, detail: `${unreadMeters.length} house${unreadMeters.length === 1 ? '' : 's'} not read: ${unreadMeters.map((account) => account.unitNumber).join(', ')}`, action: go('utilities', 'Enter readings') },
    garbageUnbilled.length > 0 && { id: 'garbage', icon: Trash2, tone: 'bg-orange-50 text-orange-600', title: `Bill garbage for ${periodLabel(period)}`, detail: `${garbageUnbilled.length} house${garbageUnbilled.length === 1 ? '' : 's'} at ${formatKsh(state.settings.garbageFee)} each.`, action: <Button onClick={() => billGarbage(period)} className="h-8 bg-slate-950 px-3 text-xs text-white hover:bg-slate-800">Bill now</Button> },
    onNotice.length > 0 && { id: 'notice', icon: Home, tone: 'bg-amber-50 text-amber-600', title: `${onNotice.length} tenant${onNotice.length === 1 ? ' is' : 's are'} on notice`, detail: `${onNotice.map((house) => `${house.unitNumber}${house.tenant ? ` (${house.tenant.name})` : ''}`).join(', ')} — line up the next tenant.`, action: go('houses', 'View houses') },
    vacant.length > 0 && { id: 'vacant', icon: Building2, tone: 'bg-sky-50 text-sky-600', title: `${vacant.length} vacant house${vacant.length === 1 ? '' : 's'} ready to let`, detail: vacant.map((house) => `${house.unitNumber} · ${formatKsh(house.defaultMonthlyRent)}`).join(', '), action: go('houses', 'Assign tenant') },
  ].filter(Boolean) as Task[]

  const longDate = new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <>
      <PageHeader eyebrow="Overview" title="Property dashboard" description={longDate} actions={<Button onClick={() => setRecording(true)} className={primaryButton}><Plus data-icon="inline-start" />Record payment</Button>} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard onClick={() => navigate('houses')} label="Occupancy" value={`${percent(occupied, houses.length)}%`} detail={`${occupied} of ${houses.length} houses let · ${vacant.length} vacant`} icon={Building2} tone="bg-blue-50 text-blue-600" />
        <StatCard onClick={() => navigate('rent')} label={`${periodLabel(period, 'short').split(' ')[0]} rent collected`} value={formatKsh(collected)} detail={<span className="block pt-1"><Progress value={percent(collected, expected)} className="bg-emerald-500" /><span className="mt-1.5 block">{percent(collected, expected)}% of {formatKsh(expected)}</span></span>} icon={WalletCards} tone="bg-emerald-50 text-emerald-600" />
        <StatCard onClick={() => navigate('rent')} label="Arrears" value={formatKsh(arrearsTotal)} detail={arrears.length ? `Overdue from ${arrears.length} tenant${arrears.length === 1 ? '' : 's'}` : 'Nobody is behind'} icon={HandCoins} tone="bg-rose-50 text-rose-600" />
        <StatCard onClick={() => navigate('payments')} label="Received this month" value={formatKsh(receivedThisMonth.reduce((sum, payment) => sum + payment.amount, 0))} detail={`${receivedThisMonth.length} payment${receivedThisMonth.length === 1 ? '' : 's'} for rent and utilities`} icon={CircleDollarSign} tone="bg-violet-50 text-violet-600" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <Card title="Needs attention" description={tasks.length ? `${tasks.length} thing${tasks.length === 1 ? '' : 's'} to deal with` : undefined} flush>
          {tasks.length ? (
            <ul className="divide-y divide-slate-100">
              {tasks.map(({ id, icon: Icon, tone, title, detail, action }) => (
                <li key={id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <div className="flex flex-1 items-start gap-3">
                    <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', tone)}><Icon className="size-[18px]" /></span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{detail}</p>
                    </div>
                  </div>
                  <div className="shrink-0 pl-12 sm:pl-0">{action}</div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-3 p-5 text-sm text-emerald-700"><CheckCircle2 className="size-5" />All caught up — nothing needs your attention.</div>
          )}
        </Card>

        <Card title="Collection trend" description="Collected vs billed for rent, water and garbage">
          {trend.length ? <CollectionTrendChart data={trend} height={180} /> : <p className="text-sm text-slate-400">The trend appears once you have billed a month.</p>}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <Card title="Recent payments" action={<button type="button" onClick={() => navigate('payments')} className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-950">View all<ArrowRight className="size-3.5" /></button>} flush>
          {recent.length ? (
            <ul className="divide-y divide-slate-100">
              {recent.map((payment) => {
                const account = accountById.get(payment.tenancyId)
                return (
                  <li key={payment.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">{initials(account?.tenantName ?? '?')}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{account?.tenantName ?? 'Unknown'} <span className="font-normal text-slate-400">· {account?.unitNumber}</span></p>
                      <p className="text-xs text-slate-400">{formatDate(payment.paidAt)} · {paymentMethods[payment.method]}{payment.reference ? ` · ${payment.reference}` : ''}</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-emerald-700">+{formatKsh(payment.amount)}</span>
                  </li>
                )
              })}
            </ul>
          ) : <p className="flex items-center gap-2 p-5 text-sm text-slate-400"><Receipt className="size-4" />No payments recorded yet.</p>}
        </Card>

        <Card title="Houses" description={`${houses.length} units`} action={<button type="button" onClick={() => navigate('houses')} className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-950">Manage<ArrowRight className="size-3.5" /></button>}>
          <ul className="flex flex-col gap-3">
            {houseStatuses.map(({ value, label, tone }) => {
              const count = houses.filter((house) => house.status === value).length
              return (
                <li key={value} className="flex items-center gap-3 text-sm">
                  <span className={cn('size-2.5 rounded-full ring-2', tone)} />
                  <span className="flex-1 text-slate-600">{label}</span>
                  <span className={cn('font-semibold tabular-nums', count ? 'text-slate-900' : 'text-slate-300')}>{count}</span>
                </li>
              )
            })}
          </ul>
        </Card>
      </div>

      {recording && <RecordPaymentDialog onClose={() => setRecording(false)} />}
    </>
  )
}
