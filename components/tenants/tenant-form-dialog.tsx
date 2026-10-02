'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import { Dialog, Field, FormError, errorMessage, inputClass } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { emptyTenantDetails, pickTenantDetails, type Tenant, type TenantDetails } from '@/lib/tenants'

export function TenantFormDialog({ tenant, onSave, onClose }: { tenant: Tenant | null; onSave: (details: TenantDetails) => Promise<void>; onClose: () => void }) {
  const [details, setDetails] = useState<TenantDetails>(() => (tenant ? pickTenantDetails(tenant) : emptyTenantDetails))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const input = (key: keyof TenantDetails, props: { type?: string; required?: boolean; placeholder?: string; autoFocus?: boolean } = {}) => (
    <input {...props} value={details[key]} onChange={(event) => setDetails((current) => ({ ...current, [key]: event.target.value }))} className={inputClass} />
  )

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
      eyebrow="Tenants"
      title={tenant ? `Edit ${tenant.fullName}` : 'Add a tenant'}
      description={tenant ? 'Update this tenant’s personal and contact details.' : 'Only name and phone are required. Assign a house from the Houses page.'}
      onClose={onClose}
    >
      <form className="mt-6 flex flex-col gap-6" onSubmit={submit}>
        <FormSection title="Personal">
          <Field label="Full name" className="sm:col-span-2">{input('fullName', { required: true, autoFocus: true })}</Field>
          <Field label="National ID">{input('nationalId')}</Field>
          <Field label="Occupation">{input('occupation')}</Field>
        </FormSection>
        <FormSection title="Contact">
          <Field label="Phone">{input('phone', { type: 'tel', required: true, placeholder: '07…' })}</Field>
          <Field label="Alternative phone">{input('altPhone', { type: 'tel' })}</Field>
          <Field label="Email" className="sm:col-span-2">{input('email', { type: 'email', placeholder: 'name@example.com' })}</Field>
        </FormSection>
        <FormSection title="Emergency contact">
          <Field label="Contact name">{input('emergencyContactName')}</Field>
          <Field label="Contact phone">{input('emergencyContactPhone', { type: 'tel' })}</Field>
        </FormSection>
        <FormError message={error} />
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} className="h-10 border-slate-300 bg-white px-4 text-slate-700 hover:bg-slate-100">Cancel</Button>
          <Button type="submit" disabled={saving} className="h-10 bg-slate-950 px-4 text-white hover:bg-slate-800">{saving ? 'Saving…' : tenant ? 'Save changes' : 'Add tenant'}</Button>
        </div>
      </form>
    </Dialog>
  )
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-4 sm:grid-cols-2">
      <legend className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{title}</legend>
      {children}
    </fieldset>
  )
}
