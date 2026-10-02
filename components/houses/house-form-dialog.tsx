'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import type { House, HouseDetails } from '@/lib/houses'
import { Dialog, Field, FormError, errorMessage, inputClass } from '@/components/dialog'

const houseTypes = ['Bedsitter', 'Studio', '1 Bedroom', '2 Bedroom', '3 Bedroom', 'Maisonette']

const emptyDetails: HouseDetails = { unitNumber: '', houseType: '', waterMeterNumber: '', electricityMeterNumber: '', defaultMonthlyRent: 0, defaultDepositAmount: 0, notes: '' }

export function HouseFormDialog({ house, onSave, onClose }: { house: House | null; onSave: (details: HouseDetails) => Promise<void>; onClose: () => void }) {
  const [details, setDetails] = useState<HouseDetails>(() => {
    if (!house) return emptyDetails
    const { unitNumber, houseType, waterMeterNumber, electricityMeterNumber, defaultMonthlyRent, defaultDepositAmount, notes } = house
    return { unitNumber, houseType, waterMeterNumber, electricityMeterNumber, defaultMonthlyRent, defaultDepositAmount, notes }
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof HouseDetails>(key: K) => (event: { target: { value: string } }) =>
    setDetails((current) => ({ ...current, [key]: typeof emptyDetails[key] === 'number' ? Number(event.target.value) : event.target.value }))

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave(details)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <Dialog
      eyebrow="Houses"
      title={house ? `Edit ${house.unitNumber}` : 'Add a house'}
      description={house ? 'Update the unit details. Rent changes apply to the next tenant only.' : 'New houses start as vacant and can be assigned a tenant once saved.'}
      onClose={onClose}
    >
      <form className="mt-6 flex flex-col gap-5" onSubmit={submit}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Unit number">
            <input required autoFocus value={details.unitNumber} onChange={set('unitNumber')} placeholder="e.g. H09" className={inputClass} />
          </Field>
          <Field label="House type">
            <input list="house-types" value={details.houseType} onChange={set('houseType')} placeholder="e.g. 1 Bedroom" className={inputClass} />
            <datalist id="house-types">{houseTypes.map((type) => <option key={type} value={type} />)}</datalist>
          </Field>
          <Field label="Monthly rent (KSh)">
            <input required type="number" min="1" value={details.defaultMonthlyRent || ''} onChange={set('defaultMonthlyRent')} className={inputClass} />
          </Field>
          <Field label="Deposit (KSh)" hint="Defaults to one month's rent if left blank.">
            <input type="number" min="0" value={details.defaultDepositAmount || ''} onChange={set('defaultDepositAmount')} className={inputClass} />
          </Field>
          <Field label="Water meter number">
            <input value={details.waterMeterNumber} onChange={set('waterMeterNumber')} className={inputClass} />
          </Field>
          <Field label="Electricity meter number">
            <input value={details.electricityMeterNumber} onChange={set('electricityMeterNumber')} className={inputClass} />
          </Field>
        </div>
        <Field label="Notes">
          <textarea rows={3} value={details.notes} onChange={set('notes')} className="resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal outline-none focus:border-slate-950" />
        </Field>
        <FormError message={error} />
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} className="h-10 border-slate-300 bg-white px-4 text-slate-700 hover:bg-slate-100">Cancel</Button>
          <Button type="submit" disabled={saving} className="h-10 bg-slate-950 px-4 text-white hover:bg-slate-800">{saving ? 'Saving…' : house ? 'Save changes' : 'Add house'}</Button>
        </div>
      </form>
    </Dialog>
  )
}
