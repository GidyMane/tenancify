'use client'

import { useState, type FormEvent } from 'react'
import { CalendarClock } from 'lucide-react'
import { Dialog, Field, FormError, errorMessage, inputClass } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import type { Account } from '@/lib/accounts'
import { useBilling } from '@/lib/billing'
import { addDays, daysBetween, formatDate, today } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Records that a tenant is leaving, or corrects a notice already given. The house shows as "Notice given". */
export function NoticeDialog({ account, onClose }: { account: Account; onClose: () => void }) {
  const { giveNotice } = useBilling()
  const editing = !!account.noticeDate
  const [noticeDate, setNoticeDate] = useState(account.noticeDate ?? today())
  const [expectedEndDate, setExpectedEndDate] = useState(account.expectedEndDate ?? addDays(account.noticeDate ?? today(), account.noticePeriodDays))
  const [reason, setReason] = useState(account.moveOutReason)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const days = daysBetween(noticeDate, expectedEndDate)
  const required = account.noticePeriodDays
  const valid = days >= 0 && noticeDate >= account.startDate

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!valid) return
    setSaving(true)
    setError(null)
    try {
      await giveNotice(account.id, { noticeDate, expectedEndDate, reason: reason.trim() || undefined })
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <Dialog
      eyebrow={`House ${account.unitNumber} · ${account.tenantName}`}
      title={editing ? 'Update notice' : 'Record notice to leave'}
      description={editing ? 'Correct the dates or reason. The house stays flagged as notice given.' : 'The house is flagged as “Notice given” so you can line up the next tenant. Rent keeps running until they move out.'}
      onClose={onClose}
    >
      <form className="mt-6 flex flex-col gap-5" onSubmit={submit}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Notice given on">
            <input required type="date" value={noticeDate} min={account.startDate} max={today()} onChange={(event) => setNoticeDate(event.target.value)} className={inputClass} />
          </Field>
          <Field label="Expected to move out on">
            <input required type="date" value={expectedEndDate} min={noticeDate} onChange={(event) => setExpectedEndDate(event.target.value)} className={inputClass} />
          </Field>
        </div>

        {valid && (
          <div className={cn('flex gap-3 rounded-2xl border p-4 text-sm', days >= required ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900')}>
            <CalendarClock className={cn('mt-0.5 size-5 shrink-0', days >= required ? 'text-emerald-600' : 'text-amber-600')} />
            <p>
              <span className="font-semibold">{days} day{days === 1 ? '' : 's'}’ notice</span>, leaving {formatDate(expectedEndDate)}.{' '}
              {days >= required
                ? `That meets the ${required}-day notice period agreed at move-in.`
                : `That is ${required - days} day${required - days === 1 ? '' : 's'} short of the ${required}-day notice period. You can decide whether to charge for it when you settle the deposit.`}
            </p>
          </div>
        )}

        <Field label="Reason (optional)">
          <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Relocating for work" className={inputClass} />
        </Field>

        <FormError message={error ?? (noticeDate < account.startDate ? `Notice can’t be before the tenancy started (${formatDate(account.startDate)}).` : null)} />
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} className="h-10 border-slate-300 bg-white px-4 text-slate-700 hover:bg-slate-100">Cancel</Button>
          <Button type="submit" disabled={saving || !valid} className="h-10 bg-slate-950 px-4 text-white hover:bg-slate-800">
            {saving ? 'Saving…' : editing ? 'Update notice' : 'Record notice'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
