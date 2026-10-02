'use client'

import { useEffect, useMemo } from 'react'
import useSWR from 'swr'
import { api, type ApiHouse } from '@/lib/api/client'
import { useDataSource } from '@/lib/data-source'
import { addMonths, currentPeriod, periodLabel, today } from '@/lib/format'

// ─── Model ──────────────────────────────────────────────────────────────
// Mirrors the API: a Tenancy freezes rent and deposit at move-in, Charges are
// what a tenancy owes, and Payments are allocated against charges.

export type ChargeType = 'RENTDEPOSIT' | 'WATERDEPOSIT' | 'TRASHDEPOSIT' | 'SECURITYDEPOSIT' | 'RENT' | 'WATER' | 'TRASH' | 'SECURITY' | 'SERVICEFEE' | 'OTHER'
export type PaymentMethod = 'MPESA' | 'BANK' | 'CASH' | 'OTHER'

export type Tenancy = {
  id: string
  houseId: string
  unitNumber: string
  tenantId: string
  tenantName: string
  tenantPhone: string
  monthlyRent: number
  depositRequired: number
  startDate: string
  endDate: string | null
  status: 'ACTIVE' | 'VACATED'
  openingWaterReading: number
}

export type Charge = {
  id: string
  tenancyId: string
  type: ChargeType
  period: string | null
  amount: number
  description: string
  dueDate: string
  createdAt: string
  voidedAt: string | null
}

export type Allocation = { chargeId: string; amount: number }

export type Payment = {
  id: string
  tenancyId: string
  amount: number
  paidAt: string
  method: PaymentMethod
  reference: string
  notes: string
  allocations: Allocation[]
  voidedAt: string | null
  voidReason: string
}

export type MeterReading = { id: string; tenancyId: string; period: string; previous: number; current: number; recordedAt: string }

export type BillingSettings = { waterRate: number; garbageFee: number; rentDueDay: number }

export type BillingState = { tenancies: Tenancy[]; charges: Charge[]; payments: Payment[]; readings: MeterReading[]; settings: BillingSettings; seq: number }

export const chargeTypes: Record<ChargeType, { label: string; tone: string; bar: string }> = {
  RENTDEPOSIT: { label: 'Deposit', tone: 'bg-violet-50 text-violet-700', bar: 'bg-violet-500' },
  WATERDEPOSIT: { label: 'Water deposit', tone: 'bg-violet-50 text-violet-700', bar: 'bg-violet-500' },
  TRASHDEPOSIT: { label: 'Garbage deposit', tone: 'bg-violet-50 text-violet-700', bar: 'bg-violet-500' },
  SECURITYDEPOSIT: { label: 'Security deposit', tone: 'bg-violet-50 text-violet-700', bar: 'bg-violet-500' },
  RENT: { label: 'Rent', tone: 'bg-blue-50 text-blue-700', bar: 'bg-blue-500' },
  WATER: { label: 'Water', tone: 'bg-cyan-50 text-cyan-700', bar: 'bg-cyan-500' },
  TRASH: { label: 'Garbage', tone: 'bg-orange-50 text-orange-700', bar: 'bg-orange-500' },
  SECURITY: { label: 'Security', tone: 'bg-slate-100 text-slate-600', bar: 'bg-slate-400' },
  SERVICEFEE: { label: 'Service fee', tone: 'bg-slate-100 text-slate-600', bar: 'bg-slate-400' },
  OTHER: { label: 'Other', tone: 'bg-slate-100 text-slate-600', bar: 'bg-slate-400' },
}

export const paymentMethods: Record<PaymentMethod, string> = { MPESA: 'M-Pesa', BANK: 'Bank', CASH: 'Cash', OTHER: 'Other' }

export const chargeLabel = (charge: Charge) => `${chargeTypes[charge.type].label}${charge.period ? ` · ${periodLabel(charge.period, 'short')}` : ''}`

// Deposits first, then rent, then water, then everything else; oldest first within a tier.
const PRIORITY: Record<ChargeType, number> = { RENTDEPOSIT: 0, WATERDEPOSIT: 0, TRASHDEPOSIT: 0, SECURITYDEPOSIT: 0, RENT: 1, WATER: 2, TRASH: 3, SECURITY: 3, SERVICEFEE: 3, OTHER: 3 }

// ─── Ledger: everything derived from the raw state ────────────────────────

export type Ledger = ReturnType<typeof buildLedger>
export type RentStatus = 'PAID' | 'PARTIAL' | 'UNPAID' | 'NOT_BILLED'

export function buildLedger(state: BillingState) {
  const livePayments = state.payments.filter((payment) => !payment.voidedAt)
  const liveCharges = state.charges.filter((charge) => !charge.voidedAt)

  const paidByCharge = new Map<string, number>()
  livePayments.forEach((payment) => payment.allocations.forEach(({ chargeId, amount }) => paidByCharge.set(chargeId, (paidByCharge.get(chargeId) ?? 0) + amount)))

  const paidOn = (charge: Charge) => paidByCharge.get(charge.id) ?? 0
  const outstandingOn = (charge: Charge) => Math.max(0, charge.amount - paidOn(charge))
  const chargesFor = (tenancyId: string) => liveCharges.filter((charge) => charge.tenancyId === tenancyId)
  const paymentsFor = (tenancyId: string) => livePayments.filter((payment) => payment.tenancyId === tenancyId)
  const unallocated = (payment: Payment) => payment.amount - payment.allocations.reduce((sum, item) => sum + item.amount, 0)

  const outstandingCharges = (tenancyId: string) =>
    chargesFor(tenancyId)
      .filter((charge) => outstandingOn(charge) > 0)
      .sort((a, b) => PRIORITY[a.type] - PRIORITY[b.type] || (a.period ?? a.dueDate).localeCompare(b.period ?? b.dueDate) || a.createdAt.localeCompare(b.createdAt))

  const account = (tenancyId: string) => {
    const charges = chargesFor(tenancyId)
    const owed = charges.reduce((sum, charge) => sum + outstandingOn(charge), 0)
    const credit = paymentsFor(tenancyId).reduce((sum, payment) => sum + unallocated(payment), 0)
    const byType = {} as Record<ChargeType, number>
    charges.forEach((charge) => { byType[charge.type] = (byType[charge.type] ?? 0) + outstandingOn(charge) })
    const lastPayment = paymentsFor(tenancyId).sort((a, b) => b.paidAt.localeCompare(a.paidAt))[0] ?? null
    return { owed, credit, balance: owed - credit, byType, lastPayment }
  }

  /** What is overdue (past its due date) as of a day, after any credit — this is what counts as arrears. */
  const arrears = (tenancyId: string, asOf: string) => {
    const overdue = outstandingCharges(tenancyId).filter((charge) => charge.dueDate <= asOf)
    const credit = paymentsFor(tenancyId).reduce((sum, payment) => sum + unallocated(payment), 0)
    const byType = {} as Record<ChargeType, number>
    overdue.forEach((charge) => { byType[charge.type] = (byType[charge.type] ?? 0) + outstandingOn(charge) })
    const oldestDue = overdue.map((charge) => charge.dueDate).sort()[0] ?? null
    return { amount: Math.max(0, overdue.reduce((sum, charge) => sum + outstandingOn(charge), 0) - credit), byType, credit, oldestDue }
  }

  const chargeFor = (tenancyId: string, type: ChargeType, period: string) =>
    liveCharges.find((charge) => charge.tenancyId === tenancyId && charge.type === type && charge.period === period) ?? null

  const rentStatus = (tenancyId: string, period: string) => {
    const charge = chargeFor(tenancyId, 'RENT', period)
    if (!charge) return { charge, amount: 0, paid: 0, balance: 0, status: 'NOT_BILLED' as RentStatus }
    const paid = paidOn(charge)
    const status: RentStatus = paid >= charge.amount ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID'
    return { charge, amount: charge.amount, paid, balance: charge.amount - paid, status }
  }

  /** Billed vs collected per charge type for one month (deposits are not monthly, so excluded). */
  const periodTotals = (period: string) => {
    const totals = {} as Record<ChargeType, { billed: number; collected: number }>
    liveCharges.filter((charge) => charge.period === period).forEach((charge) => {
      const row = (totals[charge.type] ??= { billed: 0, collected: 0 })
      row.billed += charge.amount
      row.collected += paidOn(charge)
    })
    return totals
  }

  const readingFor = (tenancyId: string, period: string) => state.readings.find((reading) => reading.tenancyId === tenancyId && reading.period === period) ?? null

  /** The last known meter value for a house, carried across tenancies. */
  const lastReading = (tenancy: Tenancy, beforePeriod: string) => {
    const houseTenancies = new Set(state.tenancies.filter((item) => item.houseId === tenancy.houseId).map((item) => item.id))
    const previous = state.readings.filter((reading) => houseTenancies.has(reading.tenancyId) && reading.period < beforePeriod).sort((a, b) => b.period.localeCompare(a.period))[0]
    return previous?.current ?? tenancy.openingWaterReading
  }

  const findByReference = (reference: string) => {
    const code = reference.trim().toUpperCase()
    return code ? livePayments.find((payment) => payment.reference.toUpperCase() === code) ?? null : null
  }

  return { livePayments, liveCharges, paidOn, outstandingOn, outstandingCharges, account, arrears, rentStatus, chargeFor, periodTotals, readingFor, lastReading, findByReference, unallocated }
}

export function autoAllocate(outstanding: Charge[], ledger: Ledger, amount: number): Allocation[] {
  let remaining = amount
  const allocations: Allocation[] = []
  for (const charge of outstanding) {
    if (remaining <= 0) break
    const portion = Math.min(remaining, ledger.outstandingOn(charge))
    allocations.push({ chargeId: charge.id, amount: portion })
    remaining -= portion
  }
  return allocations
}

// ─── State transitions (one per API action) ─────────────────────────────

const nextId = (state: BillingState, prefix: string): [string, BillingState] => [`${prefix}-${state.seq + 1}`, { ...state, seq: state.seq + 1 }]

function addCharge(state: BillingState, charge: Omit<Charge, 'id' | 'voidedAt'>): BillingState {
  const [id, next] = nextId(state, 'charge')
  return { ...next, charges: [...next.charges, { ...charge, id, voidedAt: null }] }
}

export type MoveInInput = { houseId: string; unitNumber: string; tenantId: string; tenantName: string; tenantPhone: string; monthlyRent: number; depositRequired: number; startDate: string }

/** Ends any active tenancy on the house, then starts a new one with its deposit charge. */
export function moveIn(state: BillingState, input: MoveInInput): BillingState {
  const current = state.tenancies.find((tenancy) => tenancy.houseId === input.houseId && tenancy.status === 'ACTIVE')
  let next = current ? moveOut(state, current.id, input.startDate) : state
  const ledger = buildLedger(next)
  const openingWaterReading = current ? ledger.lastReading(current, '9999-12') : next.tenancies.filter((t) => t.houseId === input.houseId).reduce((value, t) => Math.max(value, ledger.lastReading(t, '9999-12')), 0)
  const [id, withId] = nextId(next, 'tenancy')
  next = { ...withId, tenancies: [...withId.tenancies, { ...input, id, endDate: null, status: 'ACTIVE', openingWaterReading }] }
  return addCharge(next, { tenancyId: id, type: 'RENTDEPOSIT', period: null, amount: input.depositRequired, description: 'Security deposit', dueDate: input.startDate, createdAt: input.startDate })
}

export function moveOut(state: BillingState, tenancyId: string, endDate: string): BillingState {
  return { ...state, tenancies: state.tenancies.map((tenancy) => (tenancy.id === tenancyId ? { ...tenancy, status: 'VACATED', endDate } : tenancy)) }
}

/** Whether a tenancy was running at any point in the month. */
export const activeIn = (tenancy: Tenancy, period: string) => tenancy.startDate.slice(0, 7) <= period && (!tenancy.endDate || tenancy.endDate.slice(0, 7) >= period)
const dueDate = (period: string, day: number) => `${period}-${String(day).padStart(2, '0')}`

/** Creates the month's rent for every tenancy that doesn't have it yet. */
export function generateRent(state: BillingState, period: string, createdAt = today()): { state: BillingState; created: number } {
  const ledger = buildLedger(state)
  const due = state.tenancies.filter((tenancy) => tenancy.status === 'ACTIVE' && activeIn(tenancy, period) && !ledger.chargeFor(tenancy.id, 'RENT', period))
  const next = due.reduce((acc, tenancy) => addCharge(acc, { tenancyId: tenancy.id, type: 'RENT', period, amount: tenancy.monthlyRent, description: `Rent for ${periodLabel(period)}`, dueDate: dueDate(period, state.settings.rentDueDay), createdAt }), state)
  return { state: next, created: due.length }
}

export function billGarbage(state: BillingState, period: string, createdAt = today()): { state: BillingState; created: number } {
  const ledger = buildLedger(state)
  const due = state.tenancies.filter((tenancy) => tenancy.status === 'ACTIVE' && activeIn(tenancy, period) && !ledger.chargeFor(tenancy.id, 'TRASH', period))
  const next = due.reduce((acc, tenancy) => addCharge(acc, { tenancyId: tenancy.id, type: 'TRASH', period, amount: state.settings.garbageFee, description: `Garbage collection for ${periodLabel(period)}`, dueDate: dueDate(period, state.settings.rentDueDay), createdAt }), state)
  return { state: next, created: due.length }
}

export type ReadingInput = { tenancyId: string; current: number }

/** Saves meter readings and bills the units used at the current water rate. */
export function billWater(state: BillingState, period: string, entries: ReadingInput[], recordedAt = today()): BillingState {
  return entries.reduce((acc, { tenancyId, current }) => {
    const ledger = buildLedger(acc)
    const tenancy = acc.tenancies.find((item) => item.id === tenancyId)
    if (!tenancy || ledger.readingFor(tenancyId, period)) return acc
    const previous = ledger.lastReading(tenancy, period)
    const units = Math.max(0, current - previous)
    const [id, withId] = nextId(acc, 'reading')
    const withReading = { ...withId, readings: [...withId.readings, { id, tenancyId, period, previous, current, recordedAt }] }
    if (!units) return withReading
    return addCharge(withReading, { tenancyId, type: 'WATER', period, amount: units * acc.settings.waterRate, description: `Water for ${periodLabel(period)} · ${units} units`, dueDate: dueDate(addMonths(period, 1), 10), createdAt: recordedAt })
  }, state)
}

export type PaymentInput = { tenancyId: string; amount: number; paidAt: string; method: PaymentMethod; reference: string; notes: string; allocations?: Allocation[]; confirmDuplicate?: boolean }

export function recordPayment(state: BillingState, input: PaymentInput): { state: BillingState; payment: Payment } {
  const ledger = buildLedger(state)
  const allocations = (input.allocations ?? autoAllocate(ledger.outstandingCharges(input.tenancyId), ledger, input.amount)).filter((item) => item.amount > 0)
  const [id, next] = nextId(state, 'payment')
  const payment: Payment = { ...input, reference: input.reference.trim().toUpperCase(), notes: input.notes.trim(), allocations, id, voidedAt: null, voidReason: '' }
  return { state: { ...next, payments: [...next.payments, payment] }, payment }
}

export function voidPayment(state: BillingState, paymentId: string, reason: string): BillingState {
  return { ...state, payments: state.payments.map((payment) => (payment.id === paymentId ? { ...payment, voidedAt: today(), voidReason: reason } : payment)) }
}

// ─── Demo seed: three months of history replayed through the same rules ─────

export function seedBilling(): BillingState {
  const p0 = currentPeriod()
  const [p2, p1] = [addMonths(p0, -2), addMonths(p0, -1)]
  const day = (period: string, d: number) => dueDate(period, d)
  let state: BillingState = { tenancies: [], charges: [], payments: [], readings: [], settings: { waterRate: 150, garbageFee: 500, rentDueDay: 5 }, seq: 0 }

  const people = [
    { houseId: 'demo-H01', unitNumber: 'H01', tenantId: 'demo-tenant-1', tenantName: 'John Kamau', tenantPhone: '0712 445 890', rent: 15000, start: addMonths(p0, -14), meter: 100 },
    { houseId: 'demo-H02', unitNumber: 'H02', tenantId: 'demo-tenant-2', tenantName: 'Mary Wanjiku', tenantPhone: '0722 138 421', rent: 15000, start: addMonths(p0, -9), meter: 220 },
    { houseId: 'demo-H03', unitNumber: 'H03', tenantId: 'demo-tenant-3', tenantName: 'Peter Mwangi', tenantPhone: '0701 882 734', rent: 15000, start: addMonths(p0, -20), meter: 340 },
    { houseId: 'demo-H04', unitNumber: 'H04', tenantId: 'demo-tenant-4', tenantName: 'Jane Njeri', tenantPhone: '0798 224 117', rent: 18000, start: addMonths(p0, -6), meter: 80 },
    { houseId: 'demo-H06', unitNumber: 'H06', tenantId: 'demo-tenant-5', tenantName: 'Lucy Akinyi', tenantPhone: '0744 601 938', rent: 15000, start: addMonths(p0, -4), meter: 150 },
    { houseId: 'demo-H05', unitNumber: 'H05', tenantId: 'demo-tenant-7', tenantName: 'David Ochieng', tenantPhone: '0718 905 642', rent: 17000, start: addMonths(p0, -12), meter: 410 },
  ]
  let code = 0
  const ids: string[] = []
  people.forEach((person) => {
    state = moveIn(state, { houseId: person.houseId, unitNumber: person.unitNumber, tenantId: person.tenantId, tenantName: person.tenantName, tenantPhone: person.tenantPhone, monthlyRent: person.rent, depositRequired: person.rent, startDate: day(person.start, 1) })
    const tenancy = state.tenancies[state.tenancies.length - 1]
    state = { ...state, tenancies: state.tenancies.map((item) => (item.id === tenancy.id ? { ...item, openingWaterReading: person.meter } : item)) }
    ids.push(tenancy.id)
    state = pay(state, tenancy.id, person.rent, day(person.start, 1), 'BANK')
  })
  const [john, mary, peter, jane, lucy, david] = ids

  function pay(current: BillingState, tenancyId: string, amount: number | 'clear', paidAt: string, method: PaymentMethod = 'MPESA', extra = 0): BillingState {
    const ledger = buildLedger(current)
    const value = amount === 'clear' ? ledger.account(tenancyId).balance + extra : amount
    const reference = method === 'MPESA' ? `S${(7_340_000 + ++code * 7919).toString(36).toUpperCase()}KQ` : method === 'BANK' ? `BNK${2000 + ++code}` : ''
    return recordPayment(current, { tenancyId, amount: value, paidAt, method, reference, notes: '' }).state
  }
  const readings = (period: string, tenancies: string[]) =>
    tenancies.map((tenancyId, index) => ({ tenancyId, current: buildLedger(state).lastReading(state.tenancies.find((t) => t.id === tenancyId)!, period) + 8 + ((index * 3 + Number(period.slice(5)) * 5) % 9) }))

  // Two months ago: everyone billed; David leaves at month end owing money.
  state = generateRent(state, p2, day(p2, 1)).state
  state = billGarbage(state, p2, day(p2, 1)).state
  state = pay(state, jane, 'clear', day(p2, 2))
  state = pay(state, john, 'clear', day(p2, 3))
  state = pay(state, peter, 'clear', day(p2, 4), 'CASH')
  state = pay(state, mary, 'clear', day(p2, 5))
  state = pay(state, lucy, 'clear', day(p2, 6))
  state = pay(state, david, 14000, day(p2, 8))
  state = billWater(state, p2, readings(p2, [john, mary, peter, jane, lucy, david]), day(p1, 1))
  state = moveOut(state, david, day(p2, 28))

  // Last month: Mary and Lucy pay part, Peter (now on notice) pays nothing.
  state = generateRent(state, p1, day(p1, 1)).state
  state = billGarbage(state, p1, day(p1, 1)).state
  state = pay(state, jane, 'clear', day(p1, 2), 'BANK')
  state = pay(state, john, 'clear', day(p1, 3))
  state = pay(state, mary, 10000, day(p1, 5))
  state = pay(state, lucy, 8000, day(p1, 7))
  state = billWater(state, p1, readings(p1, [john, mary, peter, jane, lucy]), day(p0, 1))

  // This month: rent is out; water and garbage are not billed yet.
  state = generateRent(state, p0, day(p0, 1)).state
  state = pay(state, john, 'clear', day(p0, 1))
  state = pay(state, jane, 'clear', day(p0, 1), 'MPESA', 2000)
  return state
}

// ─── Live data: the API's tenancies, charges and payments mapped onto the same model ───

/** A billing month from the API is a date on the 1st; read it in local time so time zones can't shift the month. */
const monthOf = (iso: string) => {
  const date = new Date(iso)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
const dayOf = (iso: string) => iso.slice(0, 10)

// The API has no meter-reading table yet, so a water charge records its readings in its description.
const meterText = (previous: number, current: number) => `meter ${previous} → ${current}`
const METER_PATTERN = /meter ([\d.]+) (?:→|->) ([\d.]+)/

type LiveData = { tenancies: Tenancy[]; charges: (Omit<Charge, 'dueDate'> & { dueDate: string | null })[]; payments: Payment[]; readings: MeterReading[] }

/** Loads every tenancy (via each house's history), then each tenancy's charges and payments. */
async function loadLiveBilling(houses: ApiHouse[]): Promise<LiveData> {
  const unitByHouse = new Map(houses.map((house) => [house.id, house.unitNumber]))
  const histories = await Promise.all(houses.map((house) => api.tenanciesForHouse(house.id)))
  const tenancies: Tenancy[] = histories.flat().map((tenancy) => ({
    id: tenancy.id,
    houseId: tenancy.houseId,
    unitNumber: unitByHouse.get(tenancy.houseId) ?? '—',
    tenantId: tenancy.tenantId,
    tenantName: tenancy.tenant?.fullName ?? 'Unknown tenant',
    tenantPhone: tenancy.tenant?.phone ?? '',
    monthlyRent: Number(tenancy.monthlyRent),
    depositRequired: Number(tenancy.depositRequired),
    startDate: dayOf(tenancy.startDate),
    endDate: tenancy.actualEndDate ? dayOf(tenancy.actualEndDate) : null,
    status: tenancy.status === 'VACATED' ? 'VACATED' : 'ACTIVE',
    openingWaterReading: Number(tenancy.openingWaterReading ?? 0),
  }))

  const [chargeLists, paymentLists] = await Promise.all([
    Promise.all(tenancies.map((tenancy) => api.charges(tenancy.id))),
    Promise.all(tenancies.map((tenancy) => api.payments(tenancy.id))),
  ])

  const charges = chargeLists.flat().map((charge) => ({
    id: charge.id,
    tenancyId: charge.tenancyId,
    type: (charge.type in chargeTypes ? charge.type : 'OTHER') as ChargeType,
    period: charge.periodMonth ? monthOf(charge.periodMonth) : null,
    amount: Number(charge.amount),
    description: charge.description ?? '',
    dueDate: charge.dueDate ? dayOf(charge.dueDate) : null,
    createdAt: dayOf(charge.createdAt),
    voidedAt: charge.voidedAt ? dayOf(charge.voidedAt) : null,
  }))

  const payments: Payment[] = paymentLists.flat().map((payment) => ({
    id: payment.id,
    tenancyId: payment.tenancyId,
    amount: Number(payment.amount),
    paidAt: dayOf(payment.paidAt),
    method: payment.method,
    reference: payment.reference ?? '',
    notes: payment.notes ?? '',
    allocations: payment.allocations.map((allocation) => ({ chargeId: allocation.chargeId, amount: Number(allocation.amount) })),
    voidedAt: payment.voidedAt ? dayOf(payment.voidedAt) : null,
    voidReason: payment.voidReason ?? '',
  }))

  const readings: MeterReading[] = charges.flatMap((charge) => {
    const match = charge.type === 'WATER' && !charge.voidedAt && charge.period ? METER_PATTERN.exec(charge.description) : null
    return match ? [{ id: charge.id, tenancyId: charge.tenancyId, period: charge.period!, previous: Number(match[1]), current: Number(match[2]), recordedAt: charge.createdAt }] : []
  })

  return { tenancies, charges, payments, readings }
}

// Garbage fee and rent due day have no API field yet, so they are kept in this browser.
const SETTINGS_KEY = 'rentwise-billing-settings'
const DEFAULT_SETTINGS: BillingSettings = { waterRate: 150, garbageFee: 500, rentDueDay: 5 }
function readLocalSettings(): BillingSettings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? '{}') }
  } catch {
    return DEFAULT_SETTINGS
  }
}
function writeLocalSettings(settings: BillingSettings) {
  try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) } catch { /* Storage can be blocked; settings then last for this visit only. */ }
}

// ─── Hook ────────────────────────────────────────────────────────────────

const BILLING_KEY = 'demo-billing'
const EMPTY: BillingState = { tenancies: [], charges: [], payments: [], readings: [], settings: DEFAULT_SETTINGS, seq: 0 }

/** Billing from the API when it is reachable, otherwise editable demo data. Both expose the same actions. */
export function useBilling() {
  const source = useDataSource()
  const { data: houses } = useSWR('houses', () => api.houses())
  const { data: properties, mutate: refreshProperties } = useSWR(source === 'api' ? 'properties' : null, api.properties)
  const live = useSWR(source === 'api' && houses ? ['billing', houses.map((house) => house.id).join(',')] : null, () => loadLiveBilling(houses!))
  const demo = useSWR<BillingState>(BILLING_KEY, null, { fallbackData: seed })
  const local = useSWR<BillingSettings>('billing-settings', null, { fallbackData: DEFAULT_SETTINGS })

  useEffect(() => { local.mutate(readLocalSettings(), { revalidate: false }) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const property = properties?.[0]
  const mode: 'live' | 'demo' | 'error' | 'loading' = source === 'demo' ? 'demo' : live.data ? 'live' : live.error ? 'error' : 'loading'

  const state = useMemo<BillingState>(() => {
    if (mode === 'demo') return demo.data ?? seed
    if (mode !== 'live') return EMPTY
    const settings = { ...(local.data ?? DEFAULT_SETTINGS), waterRate: property ? Number(property.defaultWaterRate) || DEFAULT_SETTINGS.waterRate : (local.data ?? DEFAULT_SETTINGS).waterRate }
    // Rent the API generates has no due date; it falls due on the landlord's rent day.
    const charges = live.data!.charges.map((charge) => ({ ...charge, dueDate: charge.dueDate ?? (charge.period ? dueDate(charge.period, settings.rentDueDay) : charge.createdAt) }))
    return { ...live.data!, charges, settings, seq: 0 }
  }, [mode, demo.data, live.data, local.data, property])

  const ledger = useMemo(() => buildLedger(state), [state])

  const applyDemo = async <T,>(change: (current: BillingState) => { state: BillingState; result: T }) => {
    const { state: next, result } = change(demo.data ?? seed)
    await demo.mutate(next, { revalidate: false })
    return result
  }
  const requireLive = () => { if (mode !== 'live') throw live.error ?? new Error('Billing is still loading. Try again in a moment.') }
  const refresh = () => live.mutate()

  return {
    mode,
    error: live.error as Error | undefined,
    state,
    ledger,

    async recordPayment(input: PaymentInput): Promise<Payment> {
      if (mode === 'demo') return applyDemo((s) => { const r = recordPayment(s, input); return { state: r.state, result: r.payment } })
      requireLive()
      const saved = await api.recordPayment({
        tenancyId: input.tenancyId,
        amount: input.amount,
        paidAt: input.paidAt,
        method: input.method,
        reference: input.reference.trim().toUpperCase() || undefined,
        notes: input.notes.trim() || undefined,
        allocations: input.allocations,
        confirmDuplicate: input.confirmDuplicate || undefined,
      })
      await refresh()
      return { id: saved.id, tenancyId: saved.tenancyId, amount: Number(saved.amount), paidAt: dayOf(saved.paidAt), method: saved.method, reference: saved.reference ?? '', notes: saved.notes ?? '', allocations: saved.allocations.map((item) => ({ chargeId: item.chargeId, amount: Number(item.amount) })), voidedAt: null, voidReason: '' }
    },

    async voidPayment(paymentId: string, reason: string) {
      if (mode === 'demo') return applyDemo((s) => ({ state: voidPayment(s, paymentId, reason), result: undefined }))
      requireLive()
      await api.voidPayment(paymentId, reason)
      await refresh()
    },

    async generateRent(period: string): Promise<number> {
      if (mode === 'demo') return applyDemo((s) => { const r = generateRent(s, period); return { state: r.state, result: r.created } })
      requireLive()
      const { generated } = await api.generateRent(`${period}-01`)
      await refresh()
      return generated
    },

    async billGarbage(period: string): Promise<number> {
      if (mode === 'demo') return applyDemo((s) => { const r = billGarbage(s, period); return { state: r.state, result: r.created } })
      requireLive()
      const due = state.tenancies.filter((tenancy) => tenancy.status === 'ACTIVE' && activeIn(tenancy, period) && !ledger.chargeFor(tenancy.id, 'TRASH', period))
      await Promise.all(due.map((tenancy) => api.createCharge({ tenancyId: tenancy.id, type: 'TRASH', amount: state.settings.garbageFee, periodMonth: `${period}-01`, description: `Garbage collection for ${periodLabel(period)}`, dueDate: dueDate(period, state.settings.rentDueDay) })))
      await refresh()
      return due.length
    },

    async billWater(period: string, entries: ReadingInput[]): Promise<number> {
      if (mode === 'demo') return applyDemo((s) => ({ state: billWater(s, period, entries), result: entries.length }))
      requireLive()
      const bills = entries.flatMap(({ tenancyId, current }) => {
        const tenancy = state.tenancies.find((item) => item.id === tenancyId)
        if (!tenancy) return []
        const previous = ledger.lastReading(tenancy, period)
        const units = current - previous
        return units > 0 ? [{ tenancyId, type: 'WATER' as const, amount: units * state.settings.waterRate, periodMonth: `${period}-01`, description: `Water for ${periodLabel(period)} · ${meterText(previous, current)} (${units} units)`, dueDate: dueDate(addMonths(period, 1), 10) }] : []
      })
      await Promise.all(bills.map((bill) => api.createCharge(bill)))
      await refresh()
      return bills.length
    },

    async updateSettings(settings: BillingSettings) {
      writeLocalSettings(settings)
      await local.mutate(settings, { revalidate: false })
      if (mode === 'demo') return applyDemo((s) => ({ state: { ...s, settings }, result: undefined }))
      if (property && Number(property.defaultWaterRate) !== settings.waterRate) {
        await api.updateProperty(property.id, { defaultWaterRate: settings.waterRate })
        await refreshProperties()
      }
    },

    /** Demo only — on the API, move-in is a tenancy endpoint the Houses page calls; this just reloads billing. */
    async moveIn(input: MoveInInput) {
      if (mode === 'demo') return applyDemo((s) => ({ state: moveIn(s, input), result: undefined }))
      await refresh()
    },
  }
}

const seed = seedBilling()
export { BILLING_KEY }
