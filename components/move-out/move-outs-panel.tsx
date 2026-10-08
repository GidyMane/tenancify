'use client'

import type { ReactNode } from 'react'
import { CalendarClock, HandCoins, LogOut, Pencil, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Account } from '@/lib/accounts'
import { daysBetween, formatDate, formatKsh, today } from '@/lib/format'
import { useMoveOuts } from '@/lib/move-out'
import { cn } from '@/lib/utils'

export type MoveOutAction = { type: 'notice' | 'move-out' | 'settle'; account: Account }

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`
const countdown = (days: number) => (days === 0 ? 'today' : days < 0 ? `${plural(-days, 'day')} overdue` : `in ${plural(days, 'day')}`)

const outlineButton ='h-8 border-slate-300 bg-white px-3 text-xs text-slate-700 hover:bg-slate-100'

/** Flags who is leaving and which deposits still need settling, so neither is forgotten. */
export function MoveOutsPanel({ onAction }: { onAction: (action: MoveOutAction) => void }) {
  const { leaving, toSettle, error } = useMoveOuts()
  if (!leaving.length && !toSettle.length && !error) return null
  const now = today()

  return (
    <div className="mb-6 grid gap-4 lg:grid-cols-2">
      <Panel icon={CalendarClock} tone="bg-amber-50 text-amber-600" title="Leaving soon" count={leaving.length} empty="Nobody is on notice.">
        {leaving.map((account) => {
          const days = account.expectedEndDate ? daysBetween(now, account.expectedEndDate) : null
          return (
            <li key={account.id} className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{account.unitNumber} · {account.tenantName}</p>
                <p className="text-xs text-slate-500">
                  {account.expectedEndDate && days !== null ? <>Leaves {formatDate(account.expectedEndDate)} · <span className={cn(days < 0 ? 'font-medium text-rose-600' : days === 0 && 'font-medium text-amber-700')}>{countdown(days)}</span></> : 'No leaving date'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onAction({ type: 'notice', account })} className={outlineButton}><Pencil data-icon="inline-start" />Notice</Button>
                <Button onClick={() => onAction({ type: 'move-out', account })} className="h-8 bg-slate-950 px-3 text-xs text-white hover:bg-slate-800"><LogOut data-icon="inline-start" />Move out</Button>
              </div>
            </li>
          )
        })}
      </Panel>

      <Panel icon={HandCoins} tone="bg-violet-50 text-violet-600" title="Deposits to settle" count={toSettle.length} empty={error ? `Couldn’t check deposits: ${error.message}` : 'Every deposit is settled.'}>
        {toSettle.map(({ account, preview }) => (
          <li key={account.id} className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{account.unitNumber} · {account.tenantName}</p>
              <p className="text-xs text-slate-500">
                {account.endDate ? `Left ${formatDate(account.endDate)} · ` : ''}Holding {formatKsh(preview.deposit.held)}
                {preview.arrears.total > 0 ? <> · <span className="text-rose-600">owes {formatKsh(preview.arrears.total)}</span></> : ''}
              </p>
            </div>
            <Button onClick={() => onAction({ type: 'settle', account })} className="h-8 bg-slate-950 px-3 text-xs text-white hover:bg-slate-800">Settle deposit</Button>
          </li>
        ))}
      </Panel>
    </div>
  )
}

function Panel({ icon: Icon, tone, title, count, empty, children }: { icon: LucideIcon; tone: string; title: string; count: number; empty: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.03)]">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <span className={cn('flex size-8 items-center justify-center rounded-lg', tone)}><Icon className="size-4" /></span>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600">{count}</span>
      </div>
      {count ? <ul className="divide-y divide-slate-100">{children}</ul> : <p className="px-5 py-6 text-center text-sm text-slate-400">{empty}</p>}
    </section>
  )
}
