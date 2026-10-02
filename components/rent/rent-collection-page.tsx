'use client'

import { useMemo, useState } from 'react'
import { AlertCircle, CalendarPlus, CheckCircle2, CircleDollarSign, Clock, Copy, HandCoins, WalletCards } from 'lucide-react'
import { FilterChip } from '@/components/filter-chip'
import { Card, EmptyState, MonthPicker, PageHeader, Pill, Progress, SearchInput, StatCard, outlineButton, primaryButton, tableClass, tdClass, thClass, theadClass } from '@/components/page'
import { RecordPaymentDialog } from '@/components/payments/record-payment-dialog'
import { Button } from '@/components/ui/button'
import { useAccounts, type Account } from '@/lib/accounts'
import { chargeTypes, type ChargeType, type RentStatus } from '@/lib/billing'
import { currentPeriod, daysBetween, formatDate, formatKsh, percent, periodLabel, today } from '@/lib/format'
import { cn } from '@/lib/utils'

export const rentStatusMeta: Record<RentStatus, { label: string; tone: string }> = {
  PAID: { label: 'Paid', tone: 'bg-emerald-50 text-emerald-700' },
  PARTIAL: { label: 'Partly paid', tone: 'bg-amber-50 text-amber-700' },
  UNPAID: { label: 'Not paid', tone: 'bg-rose-50 text-rose-700' },
  NOT_BILLED: { label: 'Not billed', tone: 'bg-slate-100 text-slate-500' },
}

type Tab = 'month' | 'arrears'

export function RentCollectionPage() {
  const [tab, setTab] = useState<Tab>('month')
  const [period, setPeriod] = useState(currentPeriod)
  const [collectFor, setCollectFor] = useState<string | null>(null)
  const { accounts, ledger } = useAccounts()
  const arrearsCount = accounts.filter((account) => ledger.arrears(account.id, today()).amount > 0).length

  return (
    <>
      <PageHeader
        title="Rent collection"
        description="See who has paid each month’s rent, collect what’s owed, and follow up on arrears."
        actions={tab === 'month' && <MonthPicker period={period} onChange={setPeriod} />}
      />
      <div className="mb-6 inline-flex rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Rent views">
        {([['month', 'Monthly rent'], ['arrears', 'Arrears']] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn('flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium', tab === id ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800')}>
            {label}
            {id === 'arrears' && arrearsCount > 0 && <span className="rounded-full bg-rose-100 px-1.5 text-[11px] font-semibold text-rose-600">{arrearsCount}</span>}
          </button>
        ))}
      </div>
      {tab === 'month' ? <MonthlyRent period={period} onCollect={setCollectFor} /> : <Arrears onCollect={setCollectFor} />}
      {collectFor && <RecordPaymentDialog tenancyId={collectFor} onClose={() => setCollectFor(null)} />}
    </>
  )
}

function MonthlyRent({ period, onCollect }: { period: string; onCollect: (tenancyId: string) => void }) {
  const { accounts, ledger, generateRent } = useAccounts()
  const [statusFilter, setStatusFilter] = useState<RentStatus | 'ALL'>('ALL')
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const rows = useMemo(() => accounts
    .map((account) => ({ account, ...ledger.rentStatus(account.id, period) }))
    .filter((row) => row.status !== 'NOT_BILLED'), [accounts, ledger, period])
  // Tenancies running this month that have no rent charge yet (e.g. rent not generated, or a new move-in).
  const missing = accounts.filter((account) => account.status === 'ACTIVE' && account.startDate.slice(0, 7) <= period && !ledger.chargeFor(account.id, 'RENT', period))

  const expected = rows.reduce((sum, row) => sum + row.amount, 0)
  const collected = rows.reduce((sum, row) => sum + row.paid, 0)
  const count = (status: RentStatus) => rows.filter((row) => row.status === status).length

  const visible = rows.filter((row) => {
    const term = query.trim().toLowerCase()
    return (statusFilter === 'ALL' || row.status === statusFilter) && (!term || [row.account.tenantName, row.account.unitNumber].some((value) => value.toLowerCase().includes(term)))
  }).sort((a, b) => order(a.status) - order(b.status) || a.account.unitNumber.localeCompare(b.account.unitNumber, undefined, { numeric: true }))

  async function generate() {
    const created = await generateRent(period)
    setNotice(`Rent generated for ${created} tenant${created === 1 ? '' : 's'} for ${periodLabel(period)}.`)
  }

  if (!rows.length) {
    return (
      <Card>
        <EmptyState
          icon={CalendarPlus}
          title={`Rent for ${periodLabel(period)} hasn’t been generated`}
          description={missing.length ? `Create this month’s rent charge for ${missing.length} active tenant${missing.length === 1 ? '' : 's'}. Each is charged the rent agreed at move-in.` : 'There were no active tenancies in this month.'}
          action={missing.length > 0 && <Button onClick={generate} className={primaryButton}><CalendarPlus data-icon="inline-start" />Generate rent for {missing.length} tenant{missing.length === 1 ? '' : 's'}</Button>}
        />
      </Card>
    )
  }

  return (
    <>
      {notice && <p role="status" className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 className="size-4" />{notice}</p>}
      {missing.length > 0 && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2"><AlertCircle className="size-4 shrink-0" />{missing.map((account) => account.tenantName).join(', ')} {missing.length === 1 ? 'has' : 'have'} no rent charge for {periodLabel(period)}.</p>
          <Button onClick={generate} variant="outline" className={outlineButton}>Generate missing rent</Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Expected" value={formatKsh(expected)} detail={`${rows.length} tenants billed`} icon={WalletCards} tone="bg-blue-50 text-blue-600" />
        <StatCard label="Collected" value={formatKsh(collected)} detail={<span className="block pt-1"><Progress value={percent(collected, expected)} className="bg-emerald-500" /><span className="mt-1.5 block">{percent(collected, expected)}% of expected</span></span>} icon={CircleDollarSign} tone="bg-emerald-50 text-emerald-600" />
        <StatCard label="Still to collect" value={formatKsh(expected - collected)} detail={`${count('UNPAID')} not paid · ${count('PARTIAL')} partly paid`} icon={HandCoins} tone="bg-rose-50 text-rose-600" />
        <StatCard label="Fully paid" value={`${count('PAID')} of ${rows.length}`} detail="tenants have cleared this month’s rent" icon={CheckCircle2} tone="bg-violet-50 text-violet-600" />
      </div>

      <Card className="mt-6" flush>
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by payment status">
            <FilterChip active={statusFilter === 'ALL'} onClick={() => setStatusFilter('ALL')} label="All" count={rows.length} />
            {(['UNPAID', 'PARTIAL', 'PAID'] as const).map((status) => <FilterChip key={status} active={statusFilter === status} onClick={() => setStatusFilter(status)} label={rentStatusMeta[status].label} count={count(status)} />)}
          </div>
          <SearchInput value={query} onChange={setQuery} placeholder="Search tenant or house" />
        </div>
        <div className="relative overflow-x-auto">
          <table className={cn(tableClass, 'min-w-[880px]')}>
            <thead className={theadClass}>
              <tr>
                <th className={thClass}>House</th>
                <th className={thClass}>Tenant</th>
                <th className={cn(thClass, 'text-right')}>Rent</th>
                <th className={cn(thClass, 'text-right')}>Paid</th>
                <th className={cn(thClass, 'text-right')}>Balance</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Due</th>
                <th className={thClass}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map(({ account, amount, paid, balance, status, charge }) => {
                const overdueDays = charge && status !== 'PAID' ? daysBetween(charge.dueDate, today()) : 0
                return (
                  <tr key={account.id} className="hover:bg-slate-50/60">
                    <td className={cn(tdClass, 'font-semibold text-slate-900')}>{account.unitNumber}</td>
                    <td className={tdClass}>
                      <p className="font-medium text-slate-800">{account.tenantName}{account.status === 'VACATED' && <span className="ml-2 text-xs font-normal text-slate-400">moved out</span>}</p>
                      <p className="text-xs text-slate-400">{account.tenantPhone}</p>
                    </td>
                    <td className={cn(tdClass, 'text-right tabular-nums text-slate-600')}>{formatKsh(amount)}</td>
                    <td className={cn(tdClass, 'text-right tabular-nums text-slate-700')}>{paid ? formatKsh(paid) : '—'}</td>
                    <td className={cn(tdClass, 'text-right font-medium tabular-nums', balance > 0 ? 'text-rose-600' : 'text-slate-400')}>{balance > 0 ? formatKsh(balance) : '—'}</td>
                    <td className={tdClass}><Pill tone={rentStatusMeta[status].tone}>{rentStatusMeta[status].label}</Pill></td>
                    <td className={cn(tdClass, 'text-xs')}>
                      <p className="text-slate-500">{charge && formatDate(charge.dueDate)}</p>
                      {overdueDays > 0 && <p className="mt-0.5 flex items-center gap-1 font-medium text-rose-600"><Clock className="size-3" />{overdueDays} day{overdueDays === 1 ? '' : 's'} overdue</p>}
                    </td>
                    <td className={cn(tdClass, 'text-right')}>
                      {status === 'PAID' ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><CheckCircle2 className="size-4" />Cleared</span> : <Button variant="outline" onClick={() => onCollect(account.id)} className={outlineButton}>Collect</Button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!visible.length && <p className="px-5 py-10 text-center text-sm text-slate-400">No tenants match your filters.</p>}
        </div>
      </Card>
    </>
  )
}

const order = (status: RentStatus) => ({ UNPAID: 0, PARTIAL: 1, PAID: 2, NOT_BILLED: 3 })[status]

function Arrears({ onCollect }: { onCollect: (tenancyId: string) => void }) {
  const { accounts, ledger } = useAccounts()
  const [copied, setCopied] = useState<string | null>(null)

  // Only charges past their due date count as arrears; next month's rent isn't late yet.
  const rows = useMemo(() => accounts
    .map((account) => {
      const { amount, byType, credit, oldestDue } = ledger.arrears(account.id, today())
      return { account, balance: amount, byType, credit, lastPayment: ledger.account(account.id).lastPayment, oldestDays: oldestDue ? daysBetween(oldestDue, today()) : 0 }
    })
    .filter((row) => row.balance > 0)
    .sort((a, b) => b.balance - a.balance), [accounts, ledger])

  const total = rows.reduce((sum, row) => sum + row.balance, 0)
  const formerTotal = rows.filter((row) => row.account.status === 'VACATED').reduce((sum, row) => sum + row.balance, 0)

  async function copyReminder(account: Account, balance: number) {
    const message = `Hello ${account.tenantName.split(' ')[0]}, this is a reminder that your balance for house ${account.unitNumber} is ${formatKsh(balance)}. Kindly clear it at your earliest convenience. Thank you.`
    try {
      await navigator.clipboard.writeText(message)
      setCopied(account.id)
      setTimeout(() => setCopied((current) => (current === account.id ? null : current)), 2000)
    } catch { /* Clipboard can be blocked; the button simply won't confirm. */ }
  }

  if (!rows.length) return <Card><EmptyState icon={CheckCircle2} title="No arrears" description="Every tenant, current and former, is fully paid up." /></Card>

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total arrears" value={formatKsh(total)} detail={`Owed by ${rows.length} tenant${rows.length === 1 ? '' : 's'}`} icon={HandCoins} tone="bg-rose-50 text-rose-600" />
        <StatCard label="Over 30 days old" value={formatKsh(rows.filter((row) => row.oldestDays > 30).reduce((sum, row) => sum + row.balance, 0))} detail={`${rows.filter((row) => row.oldestDays > 30).length} of ${rows.length} need firm follow-up`} icon={Clock} tone="bg-amber-50 text-amber-600" />
        <StatCard label="From former tenants" value={formatKsh(formerTotal)} detail="Owed by tenants who have moved out" icon={AlertCircle} tone="bg-slate-100 text-slate-600" />
      </div>
      <Card className="mt-6" title="Who owes what" description="Everything past its due date — rent, water, garbage and deposits — largest balance first." flush>
        <div className="relative overflow-x-auto">
          <table className={cn(tableClass, 'min-w-[900px]')}>
            <thead className={theadClass}>
              <tr>
                <th className={thClass}>Tenant</th>
                <th className={cn(thClass, 'text-right')}>Owes</th>
                <th className={thClass}>Made up of</th>
                <th className={thClass}>Oldest unpaid</th>
                <th className={thClass}>Last payment</th>
                <th className={thClass}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ account, balance, byType, credit, oldestDays, lastPayment }) => (
                <tr key={account.id} className="hover:bg-slate-50/60">
                  <td className={tdClass}>
                    <p className="font-medium text-slate-800">{account.tenantName}</p>
                    <p className="text-xs text-slate-400">{account.unitNumber} · {account.tenantPhone}{account.status === 'VACATED' && ' · moved out'}</p>
                  </td>
                  <td className={cn(tdClass, 'text-right font-semibold tabular-nums text-rose-600')}>
                    {formatKsh(balance)}
                    {credit > 0 && <p className="text-xs font-normal text-emerald-600">after {formatKsh(credit)} credit</p>}
                  </td>
                  <td className={tdClass}>
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.keys(chargeTypes) as ChargeType[]).filter((type) => byType[type] > 0).map((type) => <Pill key={type} tone={chargeTypes[type].tone}>{chargeTypes[type].label} {formatKsh(byType[type])}</Pill>)}
                    </div>
                  </td>
                  <td className={tdClass}><span className={cn('text-sm', oldestDays > 30 ? 'font-medium text-rose-600' : 'text-slate-600')}>{oldestDays ? `${oldestDays} days overdue` : 'Due today'}</span></td>
                  <td className={cn(tdClass, 'text-slate-500')}>{lastPayment ? formatDate(lastPayment.paidAt) : 'Never'}</td>
                  <td className={tdClass}>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => copyReminder(account, balance)} className={outlineButton}><Copy data-icon="inline-start" />{copied === account.id ? 'Copied' : 'Reminder'}</Button>
                      <Button variant="outline" onClick={() => onCollect(account.id)} className={outlineButton}>Collect</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
