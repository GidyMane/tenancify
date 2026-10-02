'use client'

import { useState, type FormEvent } from 'react'
import { ArrowRight, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAvailableTenants, type Assignment, type House } from '@/lib/houses'
import { cn } from '@/lib/utils'
import { Dialog, Field, FormError, errorMessage, inputClass } from '@/components/dialog'

const today = () => new Date().toISOString().slice(0, 10)

export function AssignTenantDialog({ house, onAssign, onClose }: { house: House; onAssign: (assignment: Assignment) => Promise<void>; onClose: () => void }) {
  const { options, error: tenantsError } = useAvailableTenants()
  const [kind, setKind] = useState<'existing' | 'new'>('existing')
  const [tenantId, setTenantId] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [monthlyRent, setMonthlyRent] = useState(house.defaultMonthlyRent)
  const [depositRequired, setDepositRequired] = useState(house.defaultDepositAmount)
  const [startDate, setStartDate] = useState(today)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const current = house.tenant

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const tenant: Assignment['tenant'] = kind === 'existing' ? { kind, tenantId } : { kind, fullName, phone }
      await onAssign({ tenant, monthlyRent, depositRequired, startDate })
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <Dialog
      eyebrow={`House ${house.unitNumber}`}
      title={current ? 'Change tenant' : 'Assign a tenant'}
      description={current ? 'Move the current tenant out and hand the house to someone new in one step.' : 'Move a tenant into this house. It will be marked as occupied.'}
      onClose={onClose}
    >
      <form className="mt-6 flex flex-col gap-5" onSubmit={submit}>
        {current && (
          <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
            <UserRound className="size-5 shrink-0 text-amber-600" />
            <p className="text-amber-800"><span className="font-semibold">{current.name}</span> will be moved out on the start date below.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Tenant source">
          {(['existing', 'new'] as const).map((value) => (
            <button key={value} type="button" role="tab" aria-selected={kind === value} onClick={() => setKind(value)} className={cn('rounded-lg py-2 text-sm font-medium', kind === value ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800')}>
              {value === 'existing' ? 'Existing tenant' : 'New tenant'}
            </button>
          ))}
        </div>

        {kind === 'existing' ? (
          <Field label="Tenant" hint={options.length ? 'Only tenants without a house are listed.' : 'Every tenant already has a house. Add a new tenant instead.'}>
            <select required value={tenantId} onChange={(event) => setTenantId(event.target.value)} disabled={!options.length} className={inputClass}>
              <option value="" disabled>Select a tenant</option>
              {options.map((option) => <option key={option.id} value={option.id}>{option.fullName}{option.phone ? ` · ${option.phone}` : ''}</option>)}
            </select>
          </Field>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Full name">
              <input required value={fullName} onChange={(event) => setFullName(event.target.value)} className={inputClass} />
            </Field>
            <Field label="Phone">
              <input required type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+2547…" className={inputClass} />
            </Field>
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Monthly rent (KSh)">
            <input required type="number" min="1" value={monthlyRent || ''} onChange={(event) => setMonthlyRent(Number(event.target.value))} className={inputClass} />
          </Field>
          <Field label="Deposit (KSh)">
            <input required type="number" min="1" value={depositRequired || ''} onChange={(event) => setDepositRequired(Number(event.target.value))} className={inputClass} />
          </Field>
          <Field label="Start date">
            <input required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={inputClass} />
          </Field>
        </div>

        <FormError message={error ?? (tenantsError ? `Couldn't load tenants: ${tenantsError.message}` : null)} />
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} className="h-10 border-slate-300 bg-white px-4 text-slate-700 hover:bg-slate-100">Cancel</Button>
          <Button type="submit" disabled={saving} className="h-10 bg-slate-950 px-4 text-white hover:bg-slate-800">
            {saving ? 'Saving…' : current ? <>Replace tenant<ArrowRight data-icon="inline-end" /></> : 'Assign tenant'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
