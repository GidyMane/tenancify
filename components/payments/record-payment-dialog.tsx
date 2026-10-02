'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Dialog, Field, FormError, errorMessage, inputClass } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { useAccounts } from '@/lib/accounts'
import { autoAllocate, chargeLabel, paymentMethods, type Allocation, type Payment, type PaymentMethod } from '@/lib/billing'
import { formatDate, formatKsh, today } from '@/lib/format'
import { cn } from '@/lib/utils'

export function RecordPaymentDialog({ tenancyId: initialTenancyId, onClose }: { tenancyId?: string; onClose: () => void }) {
  const { accounts, accountById, ledger, recordPayment } = useAccounts()

  // Anyone currently renting, plus former tenants who still owe money.
  const payable = useMemo(() => accounts.filter((account) => account.status === 'ACTIVE' || ledger.account(account.id).balance > 0), [accounts, ledger])
  const [tenancyId, setTenancyId] = useState(initialTenancyId ?? '')
  const balanceOf = (id: string) => (id ? Math.max(0, ledger.account(id).balance) : 0)
  const [amount, setAmount] = useState(() => balanceOf(initialTenancyId ?? ''))
  const [paidAt, setPaidAt] = useState(today)
  const [method, setMethod] = useState<PaymentMethod>('MPESA')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [manual, setManual] = useState(false)
  const [manualAmounts, setManualAmounts] = useState<Record<string, number>>({})
  const [confirmDuplicate, setConfirmDuplicate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recorded, setRecorded] = useState<Payment | null>(null)

  const account = tenancyId ? accountById.get(tenancyId) : undefined
  const summary = tenancyId ? ledger.account(tenancyId) : null
  const outstanding = useMemo(() => (tenancyId ? ledger.outstandingCharges(tenancyId) : []), [tenancyId, ledger])
  const allocations: Allocation[] = manual
    ? outstanding.map((charge) => ({ chargeId: charge.id, amount: manualAmounts[charge.id] ?? 0 })).filter((item) => item.amount > 0)
    : autoAllocate(outstanding, ledger, amount || 0)
  const allocated = allocations.reduce((sum, item) => sum + item.amount, 0)
  const credit = (amount || 0) - allocated
  const duplicate = ledger.findByReference(reference)
  const needsReference = method === 'MPESA' || method === 'BANK'

  const manualError = !manual ? null : (allocated > (amount || 0) ? 'The amounts you allocated add up to more than the payment.' : outstanding.some((charge) => (manualAmounts[charge.id] ?? 0) > ledger.outstandingOn(charge)) ? 'You can’t allocate more than a charge still owes.' : null)

  function chooseTenancy(id: string) {
    setTenancyId(id)
    setAmount(balanceOf(id))
    setManualAmounts({})
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (manualError) return setError(manualError)
    if (duplicate && !confirmDuplicate) return setError('This reference has already been used. Confirm it is a different payment to continue.')
    if (duplicate && !notes.trim()) return setError('Add a note explaining why this reference appears twice.')
    setSaving(true)
    setError(null)
    try {
      setRecorded(await recordPayment({ tenancyId, amount, paidAt, method, reference, notes, allocations: manual ? allocations : undefined }))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (recorded && account) {
    const remaining = ledger.account(account.id).balance
    return (
      <Dialog eyebrow="Payments" title="Payment recorded" description={`${account.tenantName} · ${account.unitNumber}`} onClose={onClose}>
        <div className="mt-6 rounded-2xl bg-emerald-50 p-5">
          <div className="flex items-center gap-3 text-emerald-800">
            <CheckCircle2 className="size-6" />
            <p className="text-lg font-semibold">{formatKsh(recorded.amount)} received</p>
          </div>
          <p className="mt-1 text-sm text-emerald-700">{paymentMethods[recorded.method]}{recorded.reference ? ` · ${recorded.reference}` : ''} · {formatDate(recorded.paidAt)}</p>
        </div>
        <AllocationList allocations={recorded.allocations} credit={recorded.amount - recorded.allocations.reduce((sum, item) => sum + item.amount, 0)} />
        <p className="mt-4 text-sm text-slate-600">{remaining > 0 ? <>Remaining balance: <b className="text-rose-600">{formatKsh(remaining)}</b></> : remaining < 0 ? <>Account in credit: <b className="text-emerald-700">{formatKsh(-remaining)}</b></> : <b className="text-emerald-700">Account fully cleared.</b>}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => { setRecorded(null); chooseTenancy(''); setReference(''); setNotes(''); setConfirmDuplicate(false); setManual(false) }} className="h-10 border-slate-300 bg-white px-4 text-slate-700 hover:bg-slate-100">Record another</Button>
          <Button type="button" onClick={onClose} className="h-10 bg-slate-950 px-4 text-white hover:bg-slate-800">Done</Button>
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog eyebrow="Payments" title="Record a payment" description="Money is applied to deposits first, then rent, water and other charges — oldest first." onClose={onClose}>
      <form className="mt-6 flex flex-col gap-5" onSubmit={submit}>
        <Field label="Tenant">
          <select required value={tenancyId} onChange={(event) => chooseTenancy(event.target.value)} className={inputClass}>
            <option value="" disabled>Select who paid</option>
            {payable.map((item) => {
              const balance = ledger.account(item.id).balance
              return <option key={item.id} value={item.id}>{item.unitNumber} · {item.tenantName}{item.status === 'VACATED' ? ' (moved out)' : ''} — {balance > 0 ? `owes ${formatKsh(balance)}` : 'nothing owed'}</option>
            })}
          </select>
        </Field>

        {summary && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold text-slate-800">What they owe</p>
              <p className={cn('text-sm font-semibold', summary.balance > 0 ? 'text-rose-600' : 'text-emerald-700')}>{summary.balance > 0 ? formatKsh(summary.balance) : summary.balance < 0 ? `${formatKsh(-summary.balance)} credit` : 'Nothing'}</p>
            </div>
            {outstanding.length ? (
              <ul className="mt-3 divide-y divide-slate-200/70 text-sm">
                {outstanding.map((charge) => {
                  const due = ledger.outstandingOn(charge)
                  const applied = allocations.find((item) => item.chargeId === charge.id)?.amount ?? 0
                  return (
                    <li key={charge.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="text-slate-600">{chargeLabel(charge)}</span>
                      {manual ? (
                        <span className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">of {formatKsh(due)}</span>
                          <input type="number" min="0" max={due} aria-label={`Amount for ${chargeLabel(charge)}`} value={manualAmounts[charge.id] ?? ''} onChange={(event) => setManualAmounts((current) => ({ ...current, [charge.id]: Number(event.target.value) }))} className="h-9 w-28 rounded-lg border border-slate-200 bg-white px-2 text-right text-sm outline-none focus:border-slate-950" />
                        </span>
                      ) : (
                        <span className="tabular-nums">
                          <span className={cn('font-medium', applied >= due ? 'text-emerald-700' : 'text-slate-800')}>{formatKsh(due)}</span>
                          {applied > 0 && applied < due && <span className="ml-2 text-xs text-amber-600">{formatKsh(applied)} now</span>}
                          {applied >= due && <span className="ml-2 text-xs text-emerald-600">cleared</span>}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : <p className="mt-2 text-sm text-slate-500">No outstanding charges — any payment will be held as credit.</p>}
            {outstanding.length > 0 && (
              <button type="button" onClick={() => { setManual((value) => !value); setManualAmounts(Object.fromEntries(allocations.map((item) => [item.chargeId, item.amount]))) }} className="mt-2 text-xs font-medium text-slate-600 underline-offset-2 hover:text-slate-950 hover:underline">
                {manual ? 'Use automatic allocation' : 'Choose where the money goes'}
              </button>
            )}
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Amount received (KSh)" hint={credit > 0 && tenancyId ? `${formatKsh(credit)} will be kept as credit.` : undefined}>
            <input required type="number" min="1" value={amount || ''} onChange={(event) => setAmount(Number(event.target.value))} className={inputClass} />
          </Field>
          <Field label="Date received">
            <input required type="date" max={today()} value={paidAt} onChange={(event) => setPaidAt(event.target.value)} className={inputClass} />
          </Field>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Method</p>
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="Payment method">
            {(Object.keys(paymentMethods) as PaymentMethod[]).map((value) => (
              <button key={value} type="button" role="radio" aria-checked={method === value} onClick={() => setMethod(value)} className={cn('rounded-lg py-2 text-sm font-medium', method === value ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800')}>{paymentMethods[value]}</button>
            ))}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={method === 'MPESA' ? 'M-Pesa code' : method === 'BANK' ? 'Bank reference' : 'Reference (optional)'}>
            <input required={needsReference} value={reference} onChange={(event) => { setReference(event.target.value.toUpperCase()); setConfirmDuplicate(false) }} placeholder={method === 'MPESA' ? 'e.g. SJK3X8PLQA' : ''} className={cn(inputClass, 'uppercase')} />
          </Field>
          <Field label={duplicate ? 'Note (required)' : 'Note (optional)'}>
            <input value={notes} onChange={(event) => setNotes(event.target.value)} className={inputClass} />
          </Field>
        </div>

        {duplicate && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4" />This reference was already recorded</p>
            <p className="mt-1 text-amber-800">{formatKsh(duplicate.amount)} from {accountById.get(duplicate.tenancyId)?.tenantName ?? 'a tenant'} on {formatDate(duplicate.paidAt)}.</p>
            <label className="mt-3 flex items-center gap-2 font-medium">
              <input type="checkbox" checked={confirmDuplicate} onChange={(event) => setConfirmDuplicate(event.target.checked)} className="size-4 accent-amber-600" />
              This is a different payment — record it anyway
            </label>
          </div>
        )}

        <FormError message={error ?? manualError ?? null} />
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} className="h-10 border-slate-300 bg-white px-4 text-slate-700 hover:bg-slate-100">Cancel</Button>
          <Button type="submit" disabled={saving || !tenancyId} className="h-10 bg-slate-950 px-4 text-white hover:bg-slate-800">{saving ? 'Saving…' : amount ? `Record ${formatKsh(amount)}` : 'Record payment'}</Button>
        </div>
      </form>
    </Dialog>
  )
}

export function AllocationList({ allocations, credit }: { allocations: Allocation[]; credit: number }) {
  const { state } = useAccounts()
  const chargesById = new Map(state.charges.map((charge) => [charge.id, charge]))
  return (
    <ul className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200 text-sm">
      {allocations.map((item) => {
        const charge = chargesById.get(item.chargeId)
        return (
          <li key={item.chargeId} className="flex justify-between px-4 py-2.5">
            <span className="text-slate-600">{charge ? chargeLabel(charge) : 'Charge'}</span>
            <span className="font-medium tabular-nums text-slate-800">{formatKsh(item.amount)}</span>
          </li>
        )
      })}
      {credit > 0 && (
        <li className="flex justify-between px-4 py-2.5">
          <span className="text-slate-600">Held as credit</span>
          <span className="font-medium tabular-nums text-emerald-700">{formatKsh(credit)}</span>
        </li>
      )}
      {!allocations.length && credit <= 0 && <li className="px-4 py-2.5 text-slate-400">Not applied to any charge</li>}
    </ul>
  )
}
