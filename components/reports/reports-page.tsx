'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { BarChart3, CalendarRange, Clock, Download, FileText, Home, Percent, Receipt, WalletCards } from 'lucide-react'
import { BarList, CollectionTrendChart } from '@/components/charts'
import { Field, inputClass } from '@/components/dialog'
import { Card, EmptyState, MonthPicker, PageHeader, StatCard, outlineButton, tableClass, tdClass, thClass, theadClass } from '@/components/page'
import { Button } from '@/components/ui/button'
import { useAccounts, type Account } from '@/lib/accounts'
import { activeIn, chargeTypes, paymentMethods, type ChargeType, type Ledger, type PaymentMethod } from '@/lib/billing'
import { downloadCsv } from '@/lib/csv'
import { addMonths, currentPeriod, daysBetween, formatDate, formatKsh, percent, periodLabel, periodOf, today } from '@/lib/format'
import { useHouses } from '@/lib/houses'
import { cn } from '@/lib/utils'

type Report = 'summary' | 'trend' | 'aging' | 'statement'

const reports: { id: Report; label: string; icon: typeof BarChart3 }[] = [
  { id: 'summary', label: 'Monthly summary', icon: FileText },
  { id: 'trend', label: 'Collection trend', icon: BarChart3 },
  { id: 'aging', label: 'Arrears aging', icon: Clock },
  { id: 'statement', label: 'Tenant statement', icon: Receipt },
]

const monthlyTypes: ChargeType[] = ['RENT', 'WATER', 'TRASH', 'OTHER']

export function ReportsPage() {
  const [report, setReport] = useState<Report>('summary')
  const [period, setPeriod] = useState(currentPeriod)

  return (
    <>
      <PageHeader
        eyebrow="Insights"
        title="Reports"
        description="Understand how the property is performing and export the numbers for your records."
        actions={report === 'summary' && <MonthPicker period={period} onChange={setPeriod} allowFuture={0} />}
      />
      <div className="mb-6 flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 sm:inline-flex" role="tablist" aria-label="Report">
        {reports.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={report === id} onClick={() => setReport(id)} className={cn('flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium', report === id ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800')}>
            <Icon className="size-4" />{label}
          </button>
        ))}
      </div>
      {report === 'summary' && <MonthlySummary period={period} />}
      {report === 'trend' && <CollectionTrend />}
      {report === 'aging' && <ArrearsAging />}
      {report === 'statement' && <TenantStatement />}
    </>
  )
}

const ExportButton = ({ onClick }: { onClick: () => void }) => <Button variant="outline" onClick={onClick} className={outlineButton}><Download data-icon="inline-start" />Export CSV</Button>

function totalsFor(ledger: Ledger, period: string) {
  const byType = ledger.periodTotals(period)
  const billed = monthlyTypes.reduce((sum, type) => sum + (byType[type]?.billed ?? 0), 0)
  const collected = monthlyTypes.reduce((sum, type) => sum + (byType[type]?.collected ?? 0), 0)
  return { byType, billed, collected }
}

// ─── Monthly summary ─────────────────────────────────────────────────────

function MonthlySummary({ period }: { period: string }) {
  const { state, ledger } = useAccounts()
  const { houses } = useHouses()
  const { byType, billed, collected } = totalsFor(ledger, period)
  const received = state.payments.filter((payment) => !payment.voidedAt && periodOf(payment.paidAt) === period)
  const occupied = state.tenancies.filter((tenancy) => activeIn(tenancy, period)).length
  const rows = monthlyTypes.filter((type) => byType[type]).map((type) => ({ type, ...byType[type] }))

  const exportCsv = () => downloadCsv(`summary-${period}`, ['Charge', 'Billed', 'Collected', 'Outstanding', 'Collected %'], [
    ...rows.map((row) => [chargeTypes[row.type].label, row.billed, row.collected, row.billed - row.collected, percent(row.collected, row.billed)]),
    ['Total', billed, collected, billed - collected, percent(collected, billed)],
  ])

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Billed" value={formatKsh(billed)} detail={`Rent, water and garbage for ${periodLabel(period)}`} icon={WalletCards} tone="bg-blue-50 text-blue-600" />
        <StatCard label="Collected against it" value={formatKsh(collected)} detail={`${formatKsh(billed - collected)} still outstanding`} icon={Receipt} tone="bg-emerald-50 text-emerald-600" />
        <StatCard label="Collection rate" value={`${percent(collected, billed)}%`} detail="of this month’s bills are paid" icon={Percent} tone="bg-violet-50 text-violet-600" />
        <StatCard label="Occupancy" value={`${occupied} of ${houses.length}`} detail={`${percent(occupied, houses.length)}% of houses let this month`} icon={Home} tone="bg-amber-50 text-amber-600" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card title="Billed and collected by charge" description={`Bills for ${periodLabel(period)} and how much of each has been paid so far.`} action={rows.length > 0 && <ExportButton onClick={exportCsv} />} flush>
          {rows.length ? (
            <div className="relative overflow-x-auto">
              <table className={cn(tableClass, 'min-w-[520px]')}>
                <thead className={theadClass}>
                  <tr><th className={thClass}>Charge</th><th className={cn(thClass, 'text-right')}>Billed</th><th className={cn(thClass, 'text-right')}>Collected</th><th className={cn(thClass, 'text-right')}>Outstanding</th><th className={cn(thClass, 'text-right')}>Rate</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.type}>
                      <td className={tdClass}><span className="flex items-center gap-2"><span className={cn('size-2 rounded-full', chargeTypes[row.type].bar)} />{chargeTypes[row.type].label}</span></td>
                      <td className={cn(tdClass, 'text-right tabular-nums')}>{formatKsh(row.billed)}</td>
                      <td className={cn(tdClass, 'text-right tabular-nums')}>{formatKsh(row.collected)}</td>
                      <td className={cn(tdClass, 'text-right tabular-nums', row.billed > row.collected ? 'text-rose-600' : 'text-slate-400')}>{formatKsh(row.billed - row.collected)}</td>
                      <td className={cn(tdClass, 'text-right tabular-nums')}>{percent(row.collected, row.billed)}%</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50/70 font-semibold">
                    <td className={tdClass}>Total</td>
                    <td className={cn(tdClass, 'text-right tabular-nums')}>{formatKsh(billed)}</td>
                    <td className={cn(tdClass, 'text-right tabular-nums')}>{formatKsh(collected)}</td>
                    <td className={cn(tdClass, 'text-right tabular-nums')}>{formatKsh(billed - collected)}</td>
                    <td className={cn(tdClass, 'text-right tabular-nums')}>{percent(collected, billed)}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : <EmptyState icon={FileText} title={`Nothing billed in ${periodLabel(period)}`} description="Generate rent or bill utilities for this month to see it here." />}
        </Card>

        <Card title="Money received by method" description={`${received.length} payment${received.length === 1 ? '' : 's'} received in ${periodLabel(period)}, whatever they paid for.`}>
          {received.length ? (
            <BarList items={(Object.keys(paymentMethods) as PaymentMethod[]).map((method) => {
              const list = received.filter((payment) => payment.method === method)
              return { label: paymentMethods[method], value: list.reduce((sum, payment) => sum + payment.amount, 0), detail: `${list.length} payment${list.length === 1 ? '' : 's'}` }
            })} />
          ) : <p className="text-sm text-slate-400">No payments received this month.</p>}
        </Card>
      </div>
    </>
  )
}

// ─── Collection trend ────────────────────────────────────────────────────

function CollectionTrend() {
  const { ledger } = useAccounts()
  const months = Array.from({ length: 6 }, (_, index) => addMonths(currentPeriod(), index - 5))
  const data = months.map((period) => ({ period, ...totalsFor(ledger, period) })).filter((row) => row.billed > 0)

  const exportCsv = () => downloadCsv('collection-trend', ['Month', 'Billed', 'Collected', 'Outstanding', 'Collected %'], data.map((row) => [periodLabel(row.period), row.billed, row.collected, row.billed - row.collected, percent(row.collected, row.billed)]))

  if (!data.length) return <Card><EmptyState icon={BarChart3} title="No billing history yet" description="The trend appears once you have billed rent or utilities." /></Card>

  return (
    <Card title="Collected vs billed, last 6 months" description="Rent, water and garbage billed each month, and how much of it has since been paid." action={<ExportButton onClick={exportCsv} />}>
      <CollectionTrendChart data={data.map((row) => ({ label: periodLabel(row.period, 'short'), billed: row.billed, collected: row.collected }))} />
      <div className="relative -mx-5 -mb-5 mt-6 overflow-x-auto border-t border-slate-100">
        <table className={cn(tableClass, 'min-w-[520px]')}>
          <thead className={theadClass}>
            <tr><th className={thClass}>Month</th><th className={cn(thClass, 'text-right')}>Billed</th><th className={cn(thClass, 'text-right')}>Collected</th><th className={cn(thClass, 'text-right')}>Outstanding</th><th className={cn(thClass, 'text-right')}>Rate</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {[...data].reverse().map((row) => (
              <tr key={row.period}>
                <td className={tdClass}>{periodLabel(row.period)}</td>
                <td className={cn(tdClass, 'text-right tabular-nums')}>{formatKsh(row.billed)}</td>
                <td className={cn(tdClass, 'text-right tabular-nums')}>{formatKsh(row.collected)}</td>
                <td className={cn(tdClass, 'text-right tabular-nums', row.billed > row.collected ? 'text-rose-600' : 'text-slate-400')}>{formatKsh(row.billed - row.collected)}</td>
                <td className={cn(tdClass, 'text-right tabular-nums')}>{percent(row.collected, row.billed)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ─── Arrears aging ───────────────────────────────────────────────────────

const buckets = [
  { label: '1–30 days', min: 1, max: 30 },
  { label: '31–60 days', min: 31, max: 60 },
  { label: '61–90 days', min: 61, max: 90 },
  { label: 'Over 90 days', min: 91, max: Infinity },
]

function ArrearsAging() {
  const { accounts, ledger } = useAccounts()
  const asOf = today()

  const rows = useMemo(() => accounts.map((account) => {
    const amounts = buckets.map(() => 0)
    ledger.outstandingCharges(account.id).forEach((charge) => {
      const age = daysBetween(charge.dueDate, asOf)
      const index = buckets.findIndex((bucket) => age >= bucket.min && age <= bucket.max)
      if (index >= 0) amounts[index] += ledger.outstandingOn(charge)
    })
    return { account, amounts, total: amounts.reduce((sum, value) => sum + value, 0) }
  }).filter((row) => row.total > 0).sort((a, b) => b.total - a.total), [accounts, ledger, asOf])

  const columnTotals = buckets.map((_, index) => rows.reduce((sum, row) => sum + row.amounts[index], 0))
  const grandTotal = columnTotals.reduce((sum, value) => sum + value, 0)

  const exportCsv = () => downloadCsv(`arrears-aging-${asOf}`, ['House', 'Tenant', 'Status', ...buckets.map((bucket) => bucket.label), 'Total'], [
    ...rows.map((row) => [row.account.unitNumber, row.account.tenantName, row.account.status === 'ACTIVE' ? 'Current' : 'Moved out', ...row.amounts, row.total]),
    ['', 'Total', '', ...columnTotals, grandTotal],
  ])

  if (!rows.length) return <Card><EmptyState icon={Clock} title="No overdue money" description="Nothing is past its due date. Arrears will be grouped here by how long they have been owed." /></Card>

  return (
    <Card title={`Arrears by age · as of ${formatDate(asOf)}`} description="Overdue amounts grouped by how long they’ve been past their due date. Older debt is harder to recover — chase it first." action={<ExportButton onClick={exportCsv} />} flush>
      <div className="relative overflow-x-auto">
        <table className={cn(tableClass, 'min-w-[820px]')}>
          <thead className={theadClass}>
            <tr><th className={thClass}>Tenant</th>{buckets.map((bucket) => <th key={bucket.label} className={cn(thClass, 'text-right')}>{bucket.label}</th>)}<th className={cn(thClass, 'text-right')}>Total</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.account.id}>
                <td className={tdClass}>
                  <p className="font-medium text-slate-800">{row.account.tenantName}</p>
                  <p className="text-xs text-slate-400">{row.account.unitNumber}{row.account.status === 'VACATED' && ' · moved out'}</p>
                </td>
                {row.amounts.map((amount, index) => <td key={index} className={cn(tdClass, 'text-right tabular-nums', amount ? (index >= 2 ? 'font-medium text-rose-600' : 'text-slate-700') : 'text-slate-300')}>{amount ? formatKsh(amount) : '—'}</td>)}
                <td className={cn(tdClass, 'text-right font-semibold tabular-nums')}>{formatKsh(row.total)}</td>
              </tr>
            ))}
            <tr className="bg-slate-50/70 font-semibold">
              <td className={tdClass}>Total</td>
              {columnTotals.map((amount, index) => <td key={index} className={cn(tdClass, 'text-right tabular-nums')}>{formatKsh(amount)}<span className="block text-[11px] font-normal text-slate-400">{percent(amount, grandTotal)}%</span></td>)}
              <td className={cn(tdClass, 'text-right tabular-nums')}>{formatKsh(grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">Amounts are before any unapplied credit a tenant holds.</p>
    </Card>
  )
}

// ─── Tenant statement ────────────────────────────────────────────────────

type StatementLine = { date: string; description: ReactNode; text: string; charge: number; payment: number }

function TenantStatement() {
  const { accounts, state, ledger } = useAccounts()
  const [tenancyId, setTenancyId] = useState(accounts[0]?.id ?? '')
  const account = accounts.find((item) => item.id === tenancyId)

  const lines = useMemo<StatementLine[]>(() => {
    if (!account) return []
    const charges = ledger.liveCharges.filter((charge) => charge.tenancyId === account.id).map((charge) => {
      const text = charge.description || chargeTypes[charge.type].label
      return { date: charge.createdAt, description: <><span className={cn('mr-2 inline-block size-2 rounded-full', chargeTypes[charge.type].bar)} />{text}</>, text, charge: charge.amount, payment: 0 }
    })
    const payments = state.payments.filter((payment) => payment.tenancyId === account.id && !payment.voidedAt).map((payment) => {
      const text = `Payment · ${paymentMethods[payment.method]}${payment.reference ? ` ${payment.reference}` : ''}`
      return { date: payment.paidAt, description: <span className="text-emerald-700">{text}</span>, text, charge: 0, payment: payment.amount }
    })
    // Same day: bills before the payments that settle them.
    return [...charges, ...payments].sort((a, b) => a.date.localeCompare(b.date) || b.charge - a.charge)
  }, [account, ledger, state.payments])

  let running = 0
  const withBalance = lines.map((line) => ({ ...line, balance: (running += line.charge - line.payment) }))
  const totalCharged = lines.reduce((sum, line) => sum + line.charge, 0)
  const totalPaid = lines.reduce((sum, line) => sum + line.payment, 0)

  const exportCsv = () => account && downloadCsv(`statement-${account.unitNumber}-${account.tenantName.replace(/\s+/g, '-').toLowerCase()}`, ['Date', 'Description', 'Charge', 'Payment', 'Balance'], withBalance.map((line) => [line.date, line.text, line.charge || '', line.payment || '', line.balance]))

  const label = (item: Account) => `${item.unitNumber} · ${item.tenantName}${item.status === 'VACATED' ? ` (moved out ${item.endDate ? formatDate(item.endDate) : ''})` : ''}`

  return (
    <Card
      title="Tenant statement"
      description="Every charge and payment for one tenancy, with the running balance — useful when a tenant asks what they owe."
      action={<div className="flex flex-wrap items-end gap-2">
        <Field label="Tenancy" className="w-72 max-w-full">
          <select value={tenancyId} onChange={(event) => setTenancyId(event.target.value)} className={inputClass}>
            {accounts.map((item) => <option key={item.id} value={item.id}>{label(item)}</option>)}
          </select>
        </Field>
        {lines.length > 0 && <ExportButton onClick={exportCsv} />}
      </div>}
      flush
    >
      {account && (
        <div className="grid gap-4 border-b border-slate-100 p-5 text-sm sm:grid-cols-4">
          <div><p className="text-xs text-slate-400">Tenancy</p><p className="mt-0.5 font-medium"><CalendarRange className="mr-1 inline size-3.5 text-slate-400" />{formatDate(account.startDate)} – {account.endDate ? formatDate(account.endDate) : 'present'}</p></div>
          <div><p className="text-xs text-slate-400">Total charged</p><p className="mt-0.5 font-medium tabular-nums">{formatKsh(totalCharged)}</p></div>
          <div><p className="text-xs text-slate-400">Total paid</p><p className="mt-0.5 font-medium tabular-nums">{formatKsh(totalPaid)}</p></div>
          <div><p className="text-xs text-slate-400">Balance</p><p className={cn('mt-0.5 font-semibold tabular-nums', running > 0 ? 'text-rose-600' : 'text-emerald-700')}>{running > 0 ? formatKsh(running) : running < 0 ? `${formatKsh(-running)} credit` : 'Cleared'}</p></div>
        </div>
      )}
      {lines.length ? (
        <div className="relative overflow-x-auto">
          <table className={cn(tableClass, 'min-w-[720px]')}>
            <thead className={theadClass}>
              <tr><th className={thClass}>Date</th><th className={thClass}>Description</th><th className={cn(thClass, 'text-right')}>Charge</th><th className={cn(thClass, 'text-right')}>Payment</th><th className={cn(thClass, 'text-right')}>Balance</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {withBalance.map((line, index) => (
                <tr key={index}>
                  <td className={cn(tdClass, 'text-slate-500')}>{formatDate(line.date)}</td>
                  <td className={tdClass}>{line.description}</td>
                  <td className={cn(tdClass, 'text-right tabular-nums')}>{line.charge ? formatKsh(line.charge) : ''}</td>
                  <td className={cn(tdClass, 'text-right tabular-nums text-emerald-700')}>{line.payment ? formatKsh(line.payment) : ''}</td>
                  <td className={cn(tdClass, 'text-right font-medium tabular-nums', line.balance > 0 ? 'text-slate-900' : 'text-slate-400')}>{line.balance < 0 ? `${formatKsh(-line.balance)} Cr` : formatKsh(line.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState icon={Receipt} title="No activity yet" description="Charges and payments for this tenancy will be listed here." />}
    </Card>
  )
}
