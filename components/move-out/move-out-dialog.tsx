'use client'

import { useState, type FormEvent } from 'react'
import { AlertTriangle, ArrowRight, Ban, Hammer, KeyRound, type LucideIcon } from 'lucide-react'
import { Dialog, Field, FormError, errorMessage, inputClass } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import type { Account } from '@/lib/accounts'
import type { HouseStatusAfter, SettlementPreview } from '@/lib/api/client'
import { useBilling } from '@/lib/billing'
import { formatDate, formatKsh, today } from '@/lib/format'
import { useSettlementPreview } from '@/lib/move-out'
import { cn } from '@/lib/utils'
import { NoticeBadge, SettlementDone, SettlementForm, type SettlementSummary } from './settlement-form'

const nextStatuses: { value: HouseStatusAfter; label: string; detail: string; icon: LucideIcon }[] = [
  { value: 'VACANT', label: 'Ready to let', detail: 'Back on the market straight away', icon: KeyRound },
  { value: 'MAINTENANCE', label: 'Needs maintenance', detail: 'Repairs or repainting first', icon: Hammer },
  { value: 'INACTIVE', label: 'Take off the market', detail: 'Not letting it for now', icon: Ban },
]

type Step = { name: 'vacate' } | { name: 'settle'; preview: SettlementPreview } | { name: 'done'; summary: SettlementSummary }

/** Vacate, then settle the deposit straight away (or later from the Houses page). */
export function MoveOutDialog({ account, onClose }: { account: Account; onClose: () => void }) {
  const [step, setStep] = useState<Step>({ name: 'vacate' })
  // The account is a snapshot: after vacate the live list moves it to "vacated", but this dialog keeps showing it.
  const [snapshot] = useState(account)
  const eyebrow = `House ${snapshot.unitNumber} · ${snapshot.tenantName}`

  if (step.name === 'settle') {
    return (
      <Dialog eyebrow={eyebrow} title="Settle the deposit" description={`${snapshot.tenantName} has moved out. Decide what to deduct and refund — or come back to it later from the Houses page.`} onClose={onClose}>
        <SettlementForm account={{ ...snapshot, status: 'VACATED' }} preview={step.preview} onSaved={(summary) => setStep({ name: 'done', summary })} secondary={{ label: 'Settle later', onClick: onClose }} />
      </Dialog>
    )
  }
  if (step.name === 'done') {
    return (
      <Dialog eyebrow={eyebrow} title="Move-out complete" description="The tenancy is closed and the deposit is settled." onClose={onClose}>
        <SettlementDone account={snapshot} summary={step.summary} onClose={onClose} />
      </Dialog>
    )
  }
  return (
    <Dialog eyebrow={eyebrow} title="Move out" description="Ends the tenancy on the day the tenant left. You settle the deposit in the next step." onClose={onClose}>
      <VacateForm account={snapshot} onClose={onClose} onVacated={(preview) => setStep({ name: 'settle', preview })} />
    </Dialog>
  )
}

function VacateForm({ account, onClose, onVacated }: { account: Account; onClose: () => void; onVacated: (preview: SettlementPreview) => void }) {
  const { vacate } = useBilling()
  const { preview } = useSettlementPreview(account.id)
  const [actualEndDate, setActualEndDate] = useState(() => (account.expectedEndDate && account.expectedEndDate <= today() ? account.expectedEndDate : today()))
  const [moveOutReason, setMoveOutReason] = useState(account.moveOutReason)
  const [houseStatusAfter, setHouseStatusAfter] = useState<HouseStatusAfter | null>(null)
  const [houseStatusReason, setHouseStatusReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const beforeStart = actualEndDate < account.startDate

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!houseStatusAfter) return setError('Choose what happens to the house next.')
    if (beforeStart || saving) return
    setSaving(true)
    setError(null)
    try {
      onVacated(await vacate(account.id, { actualEndDate, moveOutReason: moveOutReason.trim() || undefined, houseStatusAfter, houseStatusReason: houseStatusReason.trim() || undefined }))
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <form className="mt-6 flex flex-col gap-5" onSubmit={submit}>
      <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-sm">
        <p className="text-slate-600">
          {account.noticeDate
            ? <>Gave notice on <span className="font-medium text-slate-900">{formatDate(account.noticeDate)}</span>{account.expectedEndDate && <>, expected out <span className="font-medium text-slate-900">{formatDate(account.expectedEndDate)}</span></>}.</>
            : <>No notice was recorded, so this is treated as a move-out without notice.</>}
        </p>
        {preview && (
          <>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Stat label="Deposit held" value={formatKsh(preview.deposit.held)} />
              <Stat label="Owed today" value={formatKsh(preview.arrears.total)} tone={preview.arrears.total > 0 ? 'text-rose-600' : undefined} />
              <Stat label="Likely refund" value={formatKsh(preview.suggestedRefundAmount)} tone="text-emerald-700" />
            </div>
            <div className="mt-3"><NoticeBadge compliance={preview.noticeCompliance} /></div>
          </>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Moved out on">
          <input required type="date" value={actualEndDate} min={account.startDate} onChange={(event) => setActualEndDate(event.target.value)} className={inputClass} />
        </Field>
        <Field label="Reason (optional)">
          <input value={moveOutReason} onChange={(event) => setMoveOutReason(event.target.value)} placeholder="e.g. Relocating for work" className={inputClass} />
        </Field>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-slate-700">What happens to the house next?</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {nextStatuses.map(({ value, label, detail, icon: Icon }) => (
            <label key={value} className={cn('flex cursor-pointer flex-col gap-1 rounded-xl border p-3 text-sm transition-colors', houseStatusAfter === value ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 hover:border-slate-400')}>
              <input type="radio" name="house-status-after" value={value} checked={houseStatusAfter === value} onChange={() => { setHouseStatusAfter(value); setError(null) }} className="sr-only" />
              <Icon className={cn('size-4', houseStatusAfter === value ? 'text-white' : 'text-slate-500')} />
              <span className="font-medium">{label}</span>
              <span className={cn('text-xs', houseStatusAfter === value ? 'text-white/70' : 'text-slate-400')}>{detail}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {(houseStatusAfter === 'MAINTENANCE' || houseStatusAfter === 'INACTIVE') && (
        <Field label={houseStatusAfter === 'MAINTENANCE' ? 'What needs doing? (optional)' : 'Why? (optional)'} hint="Saved in the house’s notes.">
          <input value={houseStatusReason} onChange={(event) => setHouseStatusReason(event.target.value)} placeholder={houseStatusAfter === 'MAINTENANCE' ? 'e.g. Repaint before next tenant' : ''} className={inputClass} />
        </Field>
      )}

      <p className="flex gap-2 text-xs text-slate-500"><AlertTriangle className="size-4 shrink-0 text-amber-500" />This closes the tenancy and marks {account.tenantName} as a former tenant. It can’t be undone.</p>

      <FormError message={error ?? (beforeStart ? `The move-out date can’t be before the tenancy started (${formatDate(account.startDate)}).` : null)} />
      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onClose} className="h-10 border-slate-300 bg-white px-4 text-slate-700 hover:bg-slate-100">Cancel</Button>
        <Button type="submit" disabled={saving || beforeStart} className="h-10 bg-slate-950 px-4 text-white hover:bg-slate-800">
          {saving ? 'Moving out…' : <>Confirm move-out<ArrowRight data-icon="inline-end" /></>}
        </Button>
      </div>
    </form>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={cn('mt-0.5 truncate font-semibold tabular-nums text-slate-900', tone)}>{value}</p>
    </div>
  )
}
