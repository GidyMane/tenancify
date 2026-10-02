'use client'

import { useMemo, useState } from 'react'
import { Banknote, CircleDollarSign, PiggyBank, Plus, Receipt } from 'lucide-react'
import { FilterChip } from '@/components/filter-chip'
import { Card, EmptyState, MonthPicker, PageHeader, Pill, SearchInput, StatCard, outlineButton, primaryButton, tableClass, tdClass, thClass, theadClass } from '@/components/page'
import { Button } from '@/components/ui/button'
import { useAccounts } from '@/lib/accounts'
import { chargeTypes, paymentMethods, type Payment, type PaymentMethod } from '@/lib/billing'
import { currentPeriod, formatDate, formatKsh, periodLabel, periodOf } from '@/lib/format'
import { cn } from '@/lib/utils'
import { PaymentReceiptDialog } from './payment-receipt-dialog'
import { RecordPaymentDialog } from './record-payment-dialog'

export function PaymentsPage() {
  const { state, ledger, accounts, accountById } = useAccounts()
  const [period, setPeriod] = useState(currentPeriod)
  const [allTime, setAllTime] = useState(false)
  const [method, setMethod] = useState<PaymentMethod | 'ALL'>('ALL')
  const [query, setQuery] = useState('')
  const [showVoided, setShowVoided] = useState(false)
  const [recording, setRecording] = useState(false)
  const [receipt, setReceipt] = useState<Payment | null>(null)

  const chargesById = useMemo(() => new Map(state.charges.map((charge) => [charge.id, charge])), [state.charges])
  const inScope = useMemo(() => state.payments.filter((payment) => allTime || periodOf(payment.paidAt) === period), [state.payments, allTime, period])
  const received = inScope.filter((payment) => !payment.voidedAt)
  const total = received.reduce((sum, payment) => sum + payment.amount, 0)
  const creditHeld = accounts.reduce((sum, account) => sum + ledger.account(account.id).credit, 0)

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    return inScope
      .filter((payment) => (showVoided || !payment.voidedAt) && (method === 'ALL' || payment.method === method))
      .filter((payment) => {
        if (!term) return true
        const account = accountById.get(payment.tenancyId)
        return [account?.tenantName ?? '', account?.unitNumber ?? '', payment.reference].some((value) => value.toLowerCase().includes(term))
      })
      .sort((a, b) => b.paidAt.localeCompare(a.paidAt) || b.id.localeCompare(a.id, undefined, { numeric: true }))
  }, [inScope, showVoided, method, query, accountById])

  const scopeLabel = allTime ? 'all time' : periodLabel(period)
  const voidedCount = inScope.filter((payment) => payment.voidedAt).length

  return (
    <>
      <PageHeader
        title="Payments"
        description="Every payment received, what it paid for, and a receipt for each."
        actions={<Button onClick={() => setRecording(true)} className={primaryButton}><Plus data-icon="inline-start" />Record payment</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={`Received · ${scopeLabel}`} value={formatKsh(total)} detail={`${received.length} payment${received.length === 1 ? '' : 's'}`} icon={CircleDollarSign} tone="bg-emerald-50 text-emerald-600" />
        <StatCard label="By M-Pesa" value={formatKsh(received.filter((payment) => payment.method === 'MPESA').reduce((sum, payment) => sum + payment.amount, 0))} detail={`${received.filter((payment) => payment.method !== 'MPESA').length} by bank, cash or other`} icon={Banknote} tone="bg-blue-50 text-blue-600" />
        <StatCard label="Credit held" value={formatKsh(creditHeld)} detail="Overpayments that will cover future charges" icon={PiggyBank} tone="bg-violet-50 text-violet-600" />
      </div>

      <Card className="mt-6" flush>
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <SearchInput value={query} onChange={setQuery} placeholder="Search tenant, house or reference" />
            <div className="flex flex-wrap items-center gap-2">
              {!allTime && <MonthPicker period={period} onChange={setPeriod} allowFuture={0} />}
              <button type="button" aria-pressed={allTime} onClick={() => setAllTime((value) => !value)} className={cn('rounded-xl border px-3 py-2 text-sm font-medium', allTime ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400')}>All months</button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by method">
            <FilterChip active={method === 'ALL'} onClick={() => setMethod('ALL')} label="All methods" count={received.length} />
            {(Object.keys(paymentMethods) as PaymentMethod[]).map((value) => (
              <FilterChip key={value} active={method === value} onClick={() => setMethod(value)} label={paymentMethods[value]} count={received.filter((payment) => payment.method === value).length} />
            ))}
            {voidedCount > 0 && (
              <label className="ml-auto flex items-center gap-2 text-xs font-medium text-slate-500">
                <input type="checkbox" checked={showVoided} onChange={(event) => setShowVoided(event.target.checked)} className="size-4 accent-slate-900" />
                Show {voidedCount} voided
              </label>
            )}
          </div>
        </div>

        {visible.length ? (
          <div className="relative overflow-x-auto">
            <table className={cn(tableClass, 'min-w-[860px]')}>
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Date</th>
                  <th className={thClass}>Tenant</th>
                  <th className={cn(thClass, 'text-right')}>Amount</th>
                  <th className={thClass}>Method</th>
                  <th className={thClass}>Applied to</th>
                  <th className={thClass}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((payment) => {
                  const account = accountById.get(payment.tenancyId)
                  const credit = ledger.unallocated(payment)
                  return (
                    <tr key={payment.id} className={cn('hover:bg-slate-50/60', payment.voidedAt && 'bg-slate-50/50 text-slate-400')}>
                      <td className={cn(tdClass, 'text-slate-600')}>{formatDate(payment.paidAt)}</td>
                      <td className={tdClass}>
                        <p className="font-medium text-slate-800">{account?.tenantName ?? 'Unknown'}</p>
                        <p className="text-xs text-slate-400">{account?.unitNumber}{account?.status === 'VACATED' ? ' · moved out' : ''}</p>
                      </td>
                      <td className={cn(tdClass, 'text-right font-semibold tabular-nums', payment.voidedAt ? 'line-through' : 'text-slate-900')}>{formatKsh(payment.amount)}</td>
                      <td className={tdClass}>
                        <p className="text-slate-700">{paymentMethods[payment.method]}</p>
                        <p className="font-mono text-xs text-slate-400">{payment.reference || '—'}</p>
                      </td>
                      <td className={tdClass}>
                        {payment.voidedAt ? <Pill tone="bg-rose-50 text-rose-700">Voided</Pill> : (
                          <div className="flex flex-wrap gap-1.5">
                            {payment.allocations.map((item) => {
                              const charge = chargesById.get(item.chargeId)
                              return charge && <Pill key={item.chargeId} tone={chargeTypes[charge.type].tone}>{chargeTypes[charge.type].label}{charge.period ? ` ${periodLabel(charge.period, 'short').split(' ')[0]}` : ''}</Pill>
                            })}
                            {credit > 0 && <Pill tone="bg-emerald-50 text-emerald-700">Credit {formatKsh(credit)}</Pill>}
                          </div>
                        )}
                      </td>
                      <td className={cn(tdClass, 'text-right')}>
                        <Button variant="outline" onClick={() => setReceipt(payment)} className={outlineButton}><Receipt data-icon="inline-start" />Receipt</Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Receipt}
            title={inScope.length ? 'No payments match your filters' : `No payments in ${scopeLabel}`}
            description={inScope.length ? 'Try a different method or search term.' : 'Payments you record will appear here with a receipt.'}
            action={!inScope.length && <Button onClick={() => setRecording(true)} className={primaryButton}><Plus data-icon="inline-start" />Record payment</Button>}
          />
        )}
      </Card>

      {recording && <RecordPaymentDialog onClose={() => setRecording(false)} />}
      {receipt && <PaymentReceiptDialog payment={state.payments.find((payment) => payment.id === receipt.id) ?? receipt} onClose={() => setReceipt(null)} />}
    </>
  )
}
