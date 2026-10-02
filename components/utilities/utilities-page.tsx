'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { CheckCircle2, Droplets, Gauge, Settings2, Trash2, WalletCards } from 'lucide-react'
import { Field, FormError, inputClass } from '@/components/dialog'
import { Card, EmptyState, MonthPicker, PageHeader, Pill, Progress, StatCard, outlineButton, primaryButton, tableClass, tdClass, thClass, theadClass } from '@/components/page'
import { Button } from '@/components/ui/button'
import { useAccounts } from '@/lib/accounts'
import { activeIn, type BillingSettings, type Charge, type Ledger } from '@/lib/billing'
import { addMonths, currentPeriod, formatDate, formatKsh, percent, periodLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

type Tab = 'water' | 'garbage' | 'rates'

export function UtilitiesPage() {
  const [tab, setTab] = useState<Tab>('water')
  // Meters are read at the end of a month, so default to last month until this one is over.
  const [period, setPeriod] = useState(() => addMonths(currentPeriod(), -1))

  return (
    <>
      <PageHeader
        title="Utilities"
        description="Read water meters, bill water and garbage, and set the rates you charge."
        actions={tab !== 'rates' && <MonthPicker period={period} onChange={setPeriod} allowFuture={0} />}
      />
      <div className="mb-6 inline-flex rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Utility">
        {([['water', 'Water', Droplets], ['garbage', 'Garbage', Trash2], ['rates', 'Rates', Settings2]] as const).map(([id, label, Icon]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn('flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium', tab === id ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800')}>
            <Icon className="size-4" />{label}
          </button>
        ))}
      </div>
      {tab === 'water' && <Water period={period} onEditRates={() => setTab('rates')} />}
      {tab === 'garbage' && <Garbage period={period} onEditRates={() => setTab('rates')} />}
      {tab === 'rates' && <Rates />}
    </>
  )
}

function chargeStatus(charge: Charge | null, ledger: Ledger) {
  if (!charge) return null
  const paid = ledger.paidOn(charge)
  return paid >= charge.amount ? { label: 'Paid', tone: 'bg-emerald-50 text-emerald-700' } : paid > 0 ? { label: `Paid ${formatKsh(paid)}`, tone: 'bg-amber-50 text-amber-700' } : { label: 'Not paid', tone: 'bg-rose-50 text-rose-700' }
}

function Water({ period, onEditRates }: { period: string; onEditRates: () => void }) {
  const { state, accounts, ledger, billWater } = useAccounts()
  const rate = state.settings.waterRate
  const [entries, setEntries] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const rows = useMemo(() => accounts.filter((account) => activeIn(account, period)).map((account) => {
    const reading = ledger.readingFor(account.id, period)
    const previous = reading?.previous ?? ledger.lastReading(account, period)
    return { account, reading, previous, charge: ledger.chargeFor(account.id, 'WATER', period) }
  }), [accounts, ledger, period])

  const unread = rows.filter((row) => !row.reading)
  const typed = unread.filter((row) => entries[row.account.id]?.trim())
  const invalid = typed.filter((row) => Number(entries[row.account.id]) < row.previous)
  const totals = ledger.periodTotals(period).WATER ?? { billed: 0, collected: 0 }
  const unitsUsed = rows.reduce((sum, row) => sum + (row.reading ? row.reading.current - row.reading.previous : 0), 0)

  async function bill(event: FormEvent) {
    event.preventDefault()
    if (invalid.length) return setError(`A new reading can’t be lower than the last one (${invalid.map((row) => row.account.unitNumber).join(', ')}).`)
    setError(null)
    await billWater(period, typed.map((row) => ({ tenancyId: row.account.id, current: Number(entries[row.account.id]) })))
    setEntries({})
    setNotice(`Saved ${typed.length} reading${typed.length === 1 ? '' : 's'} and billed water for ${periodLabel(period)}.`)
  }

  if (!rows.length) return <Card><EmptyState icon={Droplets} title={`No tenancies in ${periodLabel(period)}`} description="Water is billed per occupied house, from its meter readings." /></Card>

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Units used" value={`${unitsUsed.toLocaleString()} units`} detail={`at ${formatKsh(rate)} per unit`} icon={Gauge} tone="bg-cyan-50 text-cyan-600" />
        <StatCard label="Water billed" value={formatKsh(totals.billed)} detail={`${rows.length - unread.length} of ${rows.length} houses read`} icon={Droplets} tone="bg-blue-50 text-blue-600" />
        <StatCard label="Collected" value={formatKsh(totals.collected)} detail={<span className="block pt-1"><Progress value={percent(totals.collected, totals.billed)} className="bg-cyan-500" /><span className="mt-1.5 block">{percent(totals.collected, totals.billed)}% of water billed</span></span>} icon={WalletCards} tone="bg-emerald-50 text-emerald-600" />
        <StatCard label="Still to read" value={`${unread.length} house${unread.length === 1 ? '' : 's'}`} detail={unread.length ? unread.map((row) => row.account.unitNumber).join(', ') : 'All meters read'} icon={CheckCircle2} tone={unread.length ? 'bg-amber-50 text-amber-600' : 'bg-violet-50 text-violet-600'} />
      </div>

      {notice && <p role="status" className="mt-6 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 className="size-4" />{notice}</p>}

      <form onSubmit={bill}>
        <Card
          className="mt-6"
          title={`Meter readings · ${periodLabel(period)}`}
          description={<>Enter each meter’s reading at month end. Units used × {formatKsh(rate)} is billed to the tenant. <button type="button" onClick={onEditRates} className="font-medium text-slate-600 underline-offset-2 hover:underline">Change rate</button></>}
          flush
        >
          <div className="relative overflow-x-auto">
            <table className={cn(tableClass, 'min-w-[820px]')}>
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>House</th>
                  <th className={cn(thClass, 'text-right')}>Last reading</th>
                  <th className={thClass}>This reading</th>
                  <th className={cn(thClass, 'text-right')}>Units</th>
                  <th className={cn(thClass, 'text-right')}>Amount</th>
                  <th className={thClass}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(({ account, reading, previous, charge }) => {
                  const value = entries[account.id] ?? ''
                  const current = reading ? reading.current : value ? Number(value) : null
                  const units = current === null ? null : current - previous
                  const status = chargeStatus(charge, ledger)
                  return (
                    <tr key={account.id} className="hover:bg-slate-50/60">
                      <td className={tdClass}>
                        <p className="font-semibold text-slate-900">{account.unitNumber}</p>
                        <p className="text-xs text-slate-400">{account.tenantName}</p>
                      </td>
                      <td className={cn(tdClass, 'text-right tabular-nums text-slate-500')}>{previous.toLocaleString()}</td>
                      <td className={tdClass}>
                        {reading ? <span className="tabular-nums text-slate-800">{reading.current.toLocaleString()}</span> : (
                          <input type="number" min={previous} inputMode="numeric" aria-label={`Reading for ${account.unitNumber}`} value={value} onChange={(event) => setEntries((current) => ({ ...current, [account.id]: event.target.value }))} placeholder={`≥ ${previous}`} className={cn('h-9 w-32 rounded-lg border px-2 text-sm tabular-nums outline-none focus:border-slate-950', units !== null && units < 0 ? 'border-rose-400 bg-rose-50' : 'border-slate-200')} />
                        )}
                      </td>
                      <td className={cn(tdClass, 'text-right tabular-nums', units !== null && units < 0 ? 'text-rose-600' : 'text-slate-700')}>{units === null ? '—' : units.toLocaleString()}</td>
                      <td className={cn(tdClass, 'text-right font-medium tabular-nums text-slate-800')}>{units === null || units < 0 ? '—' : formatKsh(reading && charge ? charge.amount : units * rate)}</td>
                      <td className={tdClass}>
                        {status ? <Pill tone={status.tone}>{status.label}</Pill> : reading ? <Pill tone="bg-slate-100 text-slate-500">No usage</Pill> : <Pill tone="bg-amber-50 text-amber-700">Not read</Pill>}
                        {reading && <p className="mt-1 text-[11px] text-slate-400">Read {formatDate(reading.recordedAt)}</p>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {unread.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1"><FormError message={error} />{!error && <p className="text-sm text-slate-500">{typed.length ? `${typed.length} reading${typed.length === 1 ? '' : 's'} ready · ${formatKsh(typed.reduce((sum, row) => sum + Math.max(0, Number(entries[row.account.id]) - row.previous) * rate, 0))} to bill` : 'Type the new readings above, then bill them together.'}</p>}</div>
              <Button type="submit" disabled={!typed.length} className={primaryButton}>Save readings &amp; bill water</Button>
            </div>
          )}
        </Card>
      </form>
    </>
  )
}

function Garbage({ period, onEditRates }: { period: string; onEditRates: () => void }) {
  const { state, accounts, ledger, billGarbage } = useAccounts()
  const fee = state.settings.garbageFee
  const [notice, setNotice] = useState<string | null>(null)

  const rows = accounts.filter((account) => activeIn(account, period)).map((account) => ({ account, charge: ledger.chargeFor(account.id, 'TRASH', period) }))
  const unbilled = rows.filter((row) => !row.charge && row.account.status === 'ACTIVE')
  const totals = ledger.periodTotals(period).TRASH ?? { billed: 0, collected: 0 }

  async function bill() {
    const created = await billGarbage(period)
    setNotice(`Garbage billed to ${created} house${created === 1 ? '' : 's'} for ${periodLabel(period)}.`)
  }

  if (!rows.length) return <Card><EmptyState icon={Trash2} title={`No tenancies in ${periodLabel(period)}`} description="Garbage collection is billed monthly to every occupied house." /></Card>

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Monthly fee" value={formatKsh(fee)} detail={<>per occupied house · <button type="button" onClick={onEditRates} className="font-medium text-slate-600 underline-offset-2 hover:underline">change</button></>} icon={Trash2} tone="bg-orange-50 text-orange-600" />
        <StatCard label="Billed" value={formatKsh(totals.billed)} detail={`${rows.length - unbilled.length} of ${rows.length} houses`} icon={WalletCards} tone="bg-blue-50 text-blue-600" />
        <StatCard label="Collected" value={formatKsh(totals.collected)} detail={`${percent(totals.collected, totals.billed)}% of garbage billed`} icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600" />
      </div>

      {notice && <p role="status" className="mt-6 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 className="size-4" />{notice}</p>}
      {unbilled.length > 0 && (
        <div className="mt-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <p>Garbage for {periodLabel(period)} hasn’t been billed to {unbilled.length} house{unbilled.length === 1 ? '' : 's'}.</p>
          <Button onClick={bill} className={primaryButton}>Bill {unbilled.length} house{unbilled.length === 1 ? '' : 's'} · {formatKsh(unbilled.length * fee)}</Button>
        </div>
      )}

      <Card className="mt-6" title={`Garbage collection · ${periodLabel(period)}`} flush>
        <div className="relative overflow-x-auto">
          <table className={cn(tableClass, 'min-w-[600px]')}>
            <thead className={theadClass}>
              <tr>
                <th className={thClass}>House</th>
                <th className={thClass}>Tenant</th>
                <th className={cn(thClass, 'text-right')}>Charge</th>
                <th className={thClass}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ account, charge }) => {
                const status = chargeStatus(charge, ledger)
                return (
                  <tr key={account.id} className="hover:bg-slate-50/60">
                    <td className={cn(tdClass, 'font-semibold text-slate-900')}>{account.unitNumber}</td>
                    <td className={tdClass}>{account.tenantName}{account.status === 'VACATED' && <span className="ml-2 text-xs text-slate-400">moved out</span>}</td>
                    <td className={cn(tdClass, 'text-right tabular-nums')}>{charge ? formatKsh(charge.amount) : '—'}</td>
                    <td className={tdClass}>{status ? <Pill tone={status.tone}>{status.label}</Pill> : <Pill tone="bg-slate-100 text-slate-500">Not billed</Pill>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

function Rates() {
  const { state, updateSettings } = useAccounts()
  const [values, setValues] = useState<BillingSettings>(state.settings)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (key: keyof BillingSettings) => (event: { target: { value: string } }) => { setSaved(false); setValues((current) => ({ ...current, [key]: Number(event.target.value) })) }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (values.rentDueDay < 1 || values.rentDueDay > 28) return setError('Choose a due day between 1 and 28 so it exists in every month.')
    setError(null)
    await updateSettings(values)
    setSaved(true)
  }

  return (
    <Card title="Rates and due dates" description="New rates apply to bills created from now on. Bills already sent keep their amount." className="max-w-2xl">
      <form onSubmit={save} className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Water (KSh per unit)"><input required type="number" min="1" value={values.waterRate || ''} onChange={set('waterRate')} className={inputClass} /></Field>
          <Field label="Garbage (KSh per month)"><input required type="number" min="0" value={values.garbageFee || ''} onChange={set('garbageFee')} className={inputClass} /></Field>
          <Field label="Rent due on day" hint="of each month"><input required type="number" min="1" max="28" value={values.rentDueDay || ''} onChange={set('rentDueDay')} className={inputClass} /></Field>
        </div>
        <FormError message={error} />
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
          {saved && <span role="status" className="flex items-center gap-1.5 text-sm text-emerald-700"><CheckCircle2 className="size-4" />Saved</span>}
          <Button type="button" variant="outline" onClick={() => { setValues(state.settings); setSaved(false) }} className={outlineButton}>Reset</Button>
          <Button type="submit" className={primaryButton}>Save rates</Button>
        </div>
      </form>
    </Card>
  )
}
