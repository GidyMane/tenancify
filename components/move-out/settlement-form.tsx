'use client'

import { useState, type FormEvent } from 'react'
import { AlertTriangle, CheckCircle2, Link2, Plus, Trash2 } from 'lucide-react'
import { Dialog, Field, FormError, errorMessage, inputClass } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import type { Account } from '@/lib/accounts'
import type { NoticeCompliance, SettlementPreview } from '@/lib/api/client'
import { paymentMethods, useBilling, type PaymentMethod } from '@/lib/billing'
import { formatDate, formatKsh, today } from '@/lib/format'
import { newLine, shortNoticeLine, suggestedLines, toDeductionInput, useSettlementPreview, useTenancyBalance, type DeductionLine } from '@/lib/move-out'
import { cn } from '@/lib/utils'

export type SettlementSummary = { refund: number; deducted: number; stillOwed: number }

/** Opened from the Houses page for a tenant who has already moved out. */
export function SettleDepositDialog({ account, onClose }: { account: Account; onClose: () => void }) {
  const { preview, error } = useSettlementPreview(account.id)
  const [done, setDone] = useState<SettlementSummary | null>(null)

  return (
    <Dialog eyebrow={`House ${account.unitNumber} · ${account.tenantName}`} title={done ? 'Deposit settled' : 'Settle the deposit'} description={account.endDate ? `Moved out on ${formatDate(account.endDate)}.` : 'Work out what to deduct and what to refund.'} onClose={onClose}>
      {done ? <SettlementDone account={account} summary={done} onClose={onClose} />
        : preview ? <SettlementForm account={account} preview={preview} onSaved={setDone} secondary={{ label: 'Cancel', onClick: onClose }} />
          : <p className="mt-6 text-sm text-slate-400">{error ? `Couldn’t load the settlement: ${error.message}` : 'Working out the deposit…'}</p>}
    </Dialog>
  )
}

/**
 * The landlord's deposit decision. Deductions start from the preview's arrears (capped at what the deposit holds)
 * and can be edited; the refund is always what is left of the deposit, so every shilling is accounted for.
 */
export function SettlementForm({ account, preview, onSaved, secondary }: { account: Account; preview: SettlementPreview; onSaved: (summary: SettlementSummary) => void; secondary: { label: string; onClick: () => void } }) {
  const { recordSettlement } = useBilling()
  const [lines, setLines] = useState<DeductionLine[]>(() => suggestedLines(preview))
  const [noticeLine] = useState(() => shortNoticeLine(preview, account.monthlyRent))
  // null means the refund follows "deposit held − deductions"; a number is the landlord's own figure.
  const [refundInput, setRefundInput] = useState<number | null>(null)
  const balance = useTenancyBalance(account.id)
  const [refundDate, setRefundDate] = useState(today)
  const [method, setMethod] = useState<PaymentMethod>('MPESA')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // While saving, the refreshed preview already reads "settled"; keep the form up until onSaved takes over.
  if (!preview.canSettle && !saving) {
    return (
      <p className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        {preview.alreadySettled ? 'This deposit has already been settled.' : 'The deposit can be settled once the tenant has moved out.'}
      </p>
    )
  }

  const held = preview.deposit.held
  const deducted = lines.reduce((sum, line) => sum + line.amount, 0)
  const remaining = Math.max(0, held - deducted)
  const refund = refundInput ?? remaining
  // Positive: part of the deposit is neither refunded nor explained by a deduction. Negative: more is paid out than was held.
  const unaccounted = held - deducted - refund
  const paidFromDeposit = lines.reduce((sum, line) => sum + (line.chargeId ? line.amount : 0), 0)
  const stillOwed = Math.max(0, preview.arrears.total - paidFromDeposit)
  const hasNoticeLine = lines.some((line) => line.key === noticeLine?.key)

  const problem = deducted > held ? `Deductions are ${formatKsh(deducted - held)} more than the ${formatKsh(held)} deposit held. Lower them — whatever the deposit can’t cover stays on ${account.tenantName}’s balance.`
    : refund > held ? `You can’t refund more than the ${formatKsh(held)} deposit actually received.`
    : lines.some((line) => !line.reason.trim()) ? 'Give every deduction a reason.'
      : lines.some((line) => line.amount <= 0) ? 'Every deduction needs an amount above zero. Remove lines you don’t need.'
        : lines.find((line) => line.owed !== undefined && line.amount > line.owed) ? 'A deduction can’t be more than is owed on the bill it pays.'
          : null

  const update = (key: string, change: Partial<DeductionLine>) => setLines((current) => current.map((line) => (line.key === key ? { ...line, ...change } : line)))

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (problem || saving) return
    setSaving(true)
    setError(null)
    try {
      await recordSettlement(account.id, {
        refundAmount: refund,
        refundDate,
        method: refund > 0 ? method : undefined,
        notes: notes.trim() || undefined,
        deductions: lines.map(toDeductionInput),
      })
      onSaved({ refund, deducted, stillOwed })
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <form className="mt-6 flex flex-col gap-5" onSubmit={submit}>
      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-sm">
        <Figure label="Deposit held" value={formatKsh(held)} detail={preview.deposit.neverPaid > 0 ? `${formatKsh(preview.deposit.neverPaid)} was never paid` : undefined} />
        <Figure label="Owed by tenant" value={formatKsh(preview.arrears.total)} tone={preview.arrears.total > 0 ? 'text-rose-600' : undefined} />
        <Figure label="Refund" value={formatKsh(refund)} tone="text-emerald-700" />
      </div>
      {balance !== undefined && (
        <p className="-mt-3 px-1 text-xs text-slate-500">
          Account balance today: <span className={cn('font-semibold tabular-nums', balance > 0 ? 'text-rose-600' : 'text-emerald-700')}>{balance > 0 ? `${formatKsh(balance)} owed` : balance < 0 ? `${formatKsh(-balance)} in credit` : 'cleared'}</span>
          {balance > 0 && refund > 0 && ' — check before refunding someone who still owes money.'}
        </p>
      )}

      <NoticeBadge compliance={preview.noticeCompliance} />

      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">Deductions</p>
          <div className="flex gap-1">
            {noticeLine && !hasNoticeLine && (
              <button type="button" onClick={() => setLines((current) => [...current, noticeLine])} className="rounded-lg px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50">+ Short notice ({formatKsh(noticeLine.amount)})</button>
            )}
            <button type="button" onClick={() => setLines((current) => [...current, newLine({ reason: '', amount: 0 })])} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"><Plus className="size-3.5" />Add</button>
          </div>
        </div>
        {lines.length ? (
          <ul className="mt-2 flex flex-col gap-2">
            {lines.map((line) => (
              <li key={line.key} className="rounded-xl border border-slate-200 p-2">
                <div className="flex items-center gap-2">
                  <input aria-label="Reason" value={line.reason} onChange={(event) => update(line.key, { reason: event.target.value })} placeholder="e.g. Repainting" className={cn(inputClass, 'h-9 flex-1')} />
                  <input aria-label="Amount (KSh)" type="number" min="1" max={line.owed} step="1" value={line.amount || ''} onChange={(event) => update(line.key, { amount: Math.round(Number(event.target.value)) })} className={cn(inputClass, 'h-9 w-28 text-right tabular-nums')} />
                  <button type="button" onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove deduction"><Trash2 className="size-4" /></button>
                </div>
                {line.chargeId && (
                  <p className="mt-1.5 flex items-center gap-1 px-1 text-[11px] text-slate-400"><Link2 className="size-3" />Pays this bill from the deposit{line.owed !== undefined ? ` · up to ${formatKsh(line.owed)}` : ''}</p>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 rounded-xl border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">No deductions. The whole deposit is refunded.</p>}
      </div>

      <dl className="flex flex-col gap-1.5 border-y border-slate-100 py-4 text-sm">
        <Row label="Deposit held" value={formatKsh(held)} />
        <Row label="Less deductions" value={`− ${formatKsh(deducted)}`} />
        <div className="flex items-center justify-between gap-3 pt-1 font-semibold text-slate-950">
          <label htmlFor="refund-amount">Refund to tenant</label>
          <div className="flex items-center gap-2">
            {refundInput !== null && refundInput !== remaining && (
              <button type="button" onClick={() => setRefundInput(null)} className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline">Reset to {formatKsh(remaining)}</button>
            )}
            <input id="refund-amount" type="number" min="0" max={held} step="1" value={refund} onChange={(event) => setRefundInput(event.target.value === '' ? 0 : Math.max(0, Math.round(Number(event.target.value))))} className={cn(inputClass, 'h-9 w-32 text-right font-semibold tabular-nums')} />
          </div>
        </div>
      </dl>

      {unaccounted !== 0 && !problem && (
        <p role="status" className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <span>
            {unaccounted > 0
              ? <><span className="font-semibold">{formatKsh(unaccounted)} of the deposit isn’t accounted for.</span> It is neither refunded nor explained by a deduction. Add a deduction with a reason, or raise the refund.</>
              : <><span className="font-semibold">Refund plus deductions come to {formatKsh(-unaccounted)} more than the deposit held.</span> Lower the refund or a deduction so the figures add up to {formatKsh(held)}.</>}
            {' '}You can still save it as it is.
          </span>
        </p>
      )}

      {stillOwed > 0 && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-semibold">{formatKsh(stillOwed)} stays owed</span> after this settlement — the deposit doesn’t cover all of {account.tenantName}’s arrears. It remains on their balance under Rent collection.
        </p>
      )}
      {preview.unallocatedCredit > 0 && (
        <p className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900">{account.tenantName} also has {formatKsh(preview.unallocatedCredit)} of overpayment that isn’t part of the deposit. Refund it separately.</p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={refund > 0 ? 'Refund date' : 'Settlement date'}>
          <input required type="date" value={refundDate} onChange={(event) => setRefundDate(event.target.value)} className={inputClass} />
        </Field>
        {refund > 0 && (
          <Field label="Refund paid by">
            <select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)} className={inputClass}>
              {Object.entries(paymentMethods).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
        )}
      </div>
      <Field label="Notes (optional)">
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} placeholder="Anything worth keeping with this settlement" className={cn(inputClass, 'h-auto py-2')} />
      </Field>

      <FormError message={error ?? problem} />
      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={secondary.onClick} disabled={saving} className="h-10 border-slate-300 bg-white px-4 text-slate-700 hover:bg-slate-100">{secondary.label}</Button>
        <Button type="submit" disabled={saving || !!problem} className="h-10 bg-slate-950 px-4 text-white hover:bg-slate-800">
          {saving ? 'Saving…' : refund > 0 ? `Settle · refund ${formatKsh(refund)}` : 'Settle · no refund'}
        </Button>
      </div>
    </form>
  )
}

export function SettlementDone({ account, summary, onClose }: { account: Account; summary: SettlementSummary; onClose: () => void }) {
  return (
    <div className="mt-6 flex flex-col gap-5">
      <div className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
        <p>
          {summary.refund > 0 ? <><span className="font-semibold">Refund {formatKsh(summary.refund)}</span> to {account.tenantName}.</> : <span className="font-semibold">No refund is due.</span>}
          {summary.deducted > 0 && ` ${formatKsh(summary.deducted)} was deducted from the deposit.`}
          {summary.stillOwed > 0 && ` ${formatKsh(summary.stillOwed)} is still owed and stays on their balance.`}
        </p>
      </div>
      <div className="flex justify-end border-t border-slate-100 pt-5">
        <Button type="button" onClick={onClose} className="h-10 bg-slate-950 px-4 text-white hover:bg-slate-800">Done</Button>
      </div>
    </div>
  )
}

/** Notice compliance is a flag from the API, never a price. */
export function NoticeBadge({ compliance }: { compliance: NoticeCompliance }) {
  const { status, daysGiven, requiredNoticeDays, shortfallDays, basis } = compliance
  const provisional = basis !== 'ACTUAL_END' ? ' (so far)' : ''
  const [tone, text] = status === 'PROPER_NOTICE' ? ['bg-emerald-50 text-emerald-700 ring-emerald-200', `Proper notice · ${daysGiven} of ${requiredNoticeDays} days${provisional}`]
    : status === 'SHORT_NOTICE' ? ['bg-amber-50 text-amber-700 ring-amber-200', `Short notice · ${daysGiven} of ${requiredNoticeDays} days, ${shortfallDays} short${provisional}`]
      : ['bg-rose-50 text-rose-700 ring-rose-200', `No notice given · ${requiredNoticeDays}-day period`]
  return <span className={cn('w-fit rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', tone)}>{text}</span>
}

function Figure({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={cn('mt-0.5 truncate font-semibold tabular-nums text-slate-900', tone)}>{value}</p>
      {detail && <p className="mt-0.5 text-[11px] text-amber-600">{detail}</p>}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-slate-500">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}
