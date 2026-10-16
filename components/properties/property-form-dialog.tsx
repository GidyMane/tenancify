'use client'

import { useState, type FormEvent } from 'react'
import { Dialog, Field, FormError, errorMessage, inputClass } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { emptyPropertyDetails, pickPropertyDetails, type Property, type PropertyDetails } from '@/lib/properties'

type Props = {
  property: Property | null
  /** Overrides the default description, e.g. when opened from the Houses page. */
  description?: string
  onSave: (details: PropertyDetails) => Promise<void>
  onClose: () => void
}

export function PropertyFormDialog({ property, description, onSave, onClose }: Props) {
  const [details, setDetails] = useState<PropertyDetails>(() => (property ? pickPropertyDetails(property) : emptyPropertyDetails))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof PropertyDetails>(key: K) => (event: { target: { value: string } }) =>
    setDetails((current) => ({ ...current, [key]: typeof emptyPropertyDetails[key] === 'number' ? Number(event.target.value) : event.target.value }))

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
      eyebrow="Properties"
      title={property ? `Edit ${property.name}` : 'Add a property'}
      description={description ?? (property ? 'Changes to the water rate and notice period apply to new bills and new tenants.' : 'A property groups your houses. You can add houses to it once it’s saved.')}
      onClose={onClose}
    >
      <form className="mt-6 flex flex-col gap-5" onSubmit={submit}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Property name" hint="Must be unique." className="sm:col-span-2">
            <input required autoFocus value={details.name} onChange={set('name')} placeholder="e.g. Kilimani Heights" className={inputClass} />
          </Field>
          <Field label="Address">
            <input required value={details.address} onChange={set('address')} placeholder="e.g. Argwings Kodhek Rd" className={inputClass} />
          </Field>
          <Field label="Location">
            <input value={details.location} onChange={set('location')} placeholder="e.g. Kilimani, Nairobi" className={inputClass} />
          </Field>
          <Field label="Water rate per unit" hint="Used when billing water.">
            <input type="number" min="0" step="any" value={details.defaultWaterRate || ''} onChange={set('defaultWaterRate')} placeholder="0" className={inputClass} />
          </Field>
          <Field label="Notice period (days)" hint="How much notice a leaving tenant must give.">
            <input required type="number" min="1" step="1" value={details.defaultNoticePeriodDays || ''} onChange={set('defaultNoticePeriodDays')} className={inputClass} />
          </Field>
          <Field label="Currency">
            <input required maxLength={3} value={details.currency} onChange={set('currency')} className={inputClass} />
          </Field>
        </div>
        <Field label="Description">
          <textarea rows={3} value={details.description} onChange={set('description')} className="resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal outline-none focus:border-slate-950" />
        </Field>
        <FormError message={error} />
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} className="h-10 border-slate-300 bg-white px-4 text-slate-700 hover:bg-slate-100">Cancel</Button>
          <Button type="submit" disabled={saving} className="h-10 bg-slate-950 px-4 text-white hover:bg-slate-800">{saving ? 'Saving…' : property ? 'Save changes' : 'Add property'}</Button>
        </div>
      </form>
    </Dialog>
  )
}
