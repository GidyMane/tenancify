'use client'

import { useState } from 'react'
import { Ban } from 'lucide-react'
import { Dialog, Field, FormError, errorMessage, inputClass } from '@/components/dialog'
import { Pill } from '@/components/page'
import { Button } from '@/components/ui/button'
import { useAccounts } from '@/lib/accounts'
import { paymentMethods, type Payment } from '@/lib/billing'
import { formatDate, formatKsh } from '@/lib/format'
import { AllocationList } from './record-payment-dialog'

export function PaymentReceiptDialog({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const { accountById, voidPayment } = useAccounts()
  const account = accountById.get(payment.tenancyId)
  const [voiding, setVoiding] = useState(false)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const allocated = payment.allocations.reduce((sum, item) => sum + item.amount, 0)

  async function confirmVoid() {
    setSaving(true)
    setError(null)
    try {
      await voidPayment(payment.id, reason.trim())
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <Dialog eyebrow="Payment receipt" title={formatKsh(payment.amount)} description={`${account?.tenantName ?? 'Unknown tenant'} · ${account?.unitNumber ?? '—'}`} onClose={onClose}>
      {payment.voidedAt && (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <p className="font-semibold">Voided on {formatDate(payment.voidedAt)}</p>
          <p className="mt-1">{payment.voidReason}</p>
          <p className="mt-1 text-xs text-rose-600">It no longer counts towards any balance.</p>
        </div>
      )}
      <dl className="mt-5 grid grid-cols-2 gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-5 text-sm">
        <div><dt className="text-xs text-slate-400">Date received</dt><dd className="mt-0.5 font-medium">{formatDate(payment.paidAt)}</dd></div>
        <div><dt className="text-xs text-slate-400">Method</dt><dd className="mt-0.5 font-medium">{paymentMethods[payment.method]}</dd></div>
        <div><dt className="text-xs text-slate-400">Reference</dt><dd className="mt-0.5 font-medium">{payment.reference || '—'}</dd></div>
        <div><dt className="text-xs text-slate-400">Status</dt><dd className="mt-0.5">{payment.voidedAt ? <Pill tone="bg-rose-50 text-rose-700">Voided</Pill> : <Pill tone="bg-emerald-50 text-emerald-700">Received</Pill>}</dd></div>
        {payment.notes && <div className="col-span-2"><dt className="text-xs text-slate-400">Note</dt><dd className="mt-0.5">{payment.notes}</dd></div>}
      </dl>

      <p className="mt-6 text-sm font-semibold text-slate-800">Applied to</p>
      <AllocationList allocations={payment.allocations} credit={payment.amount - allocated} />

      {!payment.voidedAt && (voiding ? (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50/60 p-4">
          <p className="text-sm font-semibold text-rose-900">Void this payment?</p>
          <p className="mt-1 text-sm text-rose-800">The money it covered will show as owed again. The record is kept for the audit trail.</p>
          <Field label="Reason" className="mt-4">
            <input required autoFocus value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Recorded against the wrong tenant" className={inputClass} />
          </Field>
          <div className="mt-3"><FormError message={error} /></div>
          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setVoiding(false)} className="h-10 border-slate-300 bg-white px-4 text-slate-700 hover:bg-slate-100">Keep payment</Button>
            <Button type="button" disabled={saving || !reason.trim()} onClick={confirmVoid} className="h-10 bg-rose-600 px-4 text-white hover:bg-rose-700">{saving ? 'Voiding…' : 'Void payment'}</Button>
          </div>
        </div>
      ) : (
        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" onClick={() => setVoiding(true)} className="h-10 border-rose-200 bg-white px-4 text-rose-600 hover:bg-rose-50 hover:text-rose-700"><Ban data-icon="inline-start" />Void payment</Button>
          <Button type="button" onClick={onClose} className="h-10 bg-slate-950 px-4 text-white hover:bg-slate-800">Done</Button>
        </div>
      ))}
    </Dialog>
  )
}
