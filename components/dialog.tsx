'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Dialog({ eyebrow, title, description, onClose, children }: { eyebrow: string; title: string; description: string; onClose: () => void; children: ReactNode }) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') closeRef.current() }
    document.addEventListener('keydown', closeOnEscape)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', closeOnEscape); document.body.style.overflow = '' }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="modal-scroll max-h-[92dvh] w-full max-w-xl overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{eyebrow}</p>
            <h2 id="dialog-title" className="mt-2 text-xl font-semibold tracking-tight text-slate-950">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export const inputClass = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none focus:border-slate-950 disabled:bg-slate-50 disabled:text-slate-400'

export function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        {label}
        {children}
      </label>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

export function FormError({ message }: { message: string | null }) {
  return message ? <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{message}</p> : null
}

export const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Something went wrong. Please try again.')
