'use client'

import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Search, type LucideIcon } from 'lucide-react'
import { addMonths, currentPeriod, periodLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

// Building blocks shared by every workspace page.

export function PageHeader({ eyebrow = 'Workspace', title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{eyebrow}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function StatCard({ label, value, detail, icon: Icon, tone, onClick }: { label: string; value: string; detail?: ReactNode; icon: LucideIcon; tone: string; onClick?: () => void }) {
  const body = (
    <>
      <div className={cn('flex size-10 items-center justify-center rounded-xl', tone)}><Icon className="size-5" /></div>
      <p className="mt-5 text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
      {detail && <div className="mt-1 text-xs text-slate-400">{detail}</div>}
    </>
  )
  const className = 'rounded-2xl border border-slate-200/80 bg-white p-5 text-left shadow-[0_2px_10px_rgba(15,23,42,0.03)]'
  return onClick ? <button type="button" onClick={onClick} className={cn(className, 'transition-colors hover:border-slate-300')}>{body}</button> : <div className={className}>{body}</div>
}

export function Card({ title, description, action, children, className, flush = false }: { title?: string; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={cn('overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.03)]', className)}>
      {(title || action) && (
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
          <div>
            {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
            {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={flush ? undefined : 'p-5'}>{children}</div>
    </section>
  )
}

export function MonthPicker({ period, onChange, allowFuture = 1 }: { period: string; onChange: (period: string) => void; allowFuture?: number }) {
  const latest = addMonths(currentPeriod(), allowFuture)
  return (
    <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
      <button type="button" onClick={() => onChange(addMonths(period, -1))} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Previous month"><ChevronLeft className="size-4" /></button>
      <span className="min-w-32 text-center text-sm font-medium text-slate-800" aria-live="polite">{periodLabel(period)}</span>
      <button type="button" disabled={period >= latest} onClick={() => onChange(addMonths(period, 1))} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="Next month"><ChevronRight className="size-4" /></button>
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="relative block w-full sm:max-w-xs">
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-slate-950" />
    </label>
  )
}

export function Pill({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium', tone)}>{children}</span>
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><Icon className="size-6" /></div>
      <p className="mt-4 font-semibold text-slate-900">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/** Horizontal progress bar; `value` is 0–100. */
export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-all', className ?? 'bg-slate-900')} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

export const tableClass = 'w-full whitespace-nowrap text-left text-sm'
export const theadClass = 'bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-400'
export const thClass = 'px-5 py-3 font-medium'
export const tdClass = 'px-5 py-4'
export const outlineButton = 'h-9 border-slate-300 bg-white px-3 text-slate-700 hover:bg-slate-100'
export const primaryButton = 'h-10 bg-slate-950 px-4 text-white hover:bg-slate-800'
