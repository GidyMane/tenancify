'use client'

import { useEffect, useMemo } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { api, type ApiHouse, type NoticeCompliance, type NoticeInput, type SettlementInput, type SettlementPreview, type VacateInput } from '@/lib/api/client'
import { useDataSource } from '@/lib/data-source'
import { demoHouses, demoTenants } from '@/lib/demo-data'
import { addMonths, currentPeriod, daysBetween, periodLabel, today } from '@/lib/format'
import { ALL_PROPERTIES, usePropertyScope } from '@/lib/property-scope'
import type { House } from '@/lib/houses'
import type { Tenant } from '@/lib/tenants'

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
  /** A tenant on notice stays ACTIVE here: they still live in the house and still owe rent. */
  status: 'ACTIVE' | 'VACATED'
  openingWaterReading: number
  noticePeriodDays: number
  noticeDate: string | null
  expectedEndDate: string | null
  moveOutReason: string
}

export const onNotice = (tenancy: Tenancy) => tenancy.status === 'ACTIVE' && !!tenancy.noticeDate

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

/** The deposit decision recorded once a tenant has left. */
export type Settlement = { id: string; tenancyId: string; depositHeld: number; refundAmount: number; refundDate: string | null; method: PaymentMethod | null; notes: string; deductions: { reason: string; amount: number }[]; createdAt: string }

export type BillingState = { tenancies: Tenancy[]; charges: Charge[]; payments: Payment[]; readings: MeterReading[]; settlements: Settlement[]; settings: BillingSettings; seq: number }

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

export const isDeposit = (type: ChargeType) => type.endsWith('DEPOSIT')

export const chargeLabel =(charge: Charge) => `${chargeTypes[charge.type].label}${charge.period ? ` · ${periodLabel(charge.period, 'short')}` : ''}`

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

  return { livePayments, liveCharges, paidOn, outstandingOn, outstandingCharges, paymentsFor, account, arrears, rentStatus, chargeFor, periodTotals, readingFor, lastReading, findByReference, unallocated }
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
  next = { ...withId, tenancies: [...withId.tenancies, { ...input, id, endDate: null, status: 'ACTIVE', openingWaterReading, noticePeriodDays: DEFAULT_NOTICE_DAYS, noticeDate: null, expectedEndDate: null, moveOutReason: '' }] }
  return addCharge(next, { tenancyId: id, type: 'RENTDEPOSIT', period: null, amount: input.depositRequired, description: 'Security deposit', dueDate: input.startDate, createdAt: input.startDate })
}

export function moveOut(state: BillingState, tenancyId: string, endDate: string): BillingState {
  return { ...state, tenancies: state.tenancies.map((tenancy) => (tenancy.id === tenancyId ? { ...tenancy, status: 'VACATED', endDate } : tenancy)) }
}

// ─── Moving out: the API's notice → vacate → settlement rules, for demo data ──

const DEFAULT_NOTICE_DAYS = 30

const findTenancy = (state: BillingState, tenancyId: string) => {
  const tenancy = state.tenancies.find((item) => item.id === tenancyId)
  if (!tenancy) throw new Error('That tenancy no longer exists.')
  return tenancy
}
const updateTenancy = (state: BillingState, tenancyId: string, change: Partial<Tenancy>): BillingState =>
  ({ ...state, tenancies: state.tenancies.map((tenancy) => (tenancy.id === tenancyId ? { ...tenancy, ...change } : tenancy)) })

/** Records (or corrects) a notice. The tenancy stays active until vacate. */
export function giveNotice(state: BillingState, tenancyId: string, input: NoticeInput): BillingState {
  if (findTenancy(state, tenancyId).status === 'VACATED') throw new Error('This tenancy has already ended')
  return updateTenancy(state, tenancyId, { noticeDate: input.noticeDate, expectedEndDate: input.expectedEndDate, ...(input.reason !== undefined ? { moveOutReason: input.reason } : {}) })
}

/** Ends the tenancy, then spends any leftover credit on what is still owed, since no new charge will ever absorb it. */
export function vacate(state: BillingState, tenancyId: string, input: VacateInput): BillingState {
  if (findTenancy(state, tenancyId).status === 'VACATED') throw new Error('This tenancy has already ended')
  let next = updateTenancy(moveOut(state, tenancyId, input.actualEndDate), tenancyId, input.moveOutReason !== undefined ? { moveOutReason: input.moveOutReason } : {})
  const payments = next.payments.filter((payment) => payment.tenancyId === tenancyId && !payment.voidedAt).sort((a, b) => a.paidAt.localeCompare(b.paidAt))
  for (const { id } of payments) {
    const ledger = buildLedger(next)
    const payment = next.payments.find((item) => item.id === id)!
    const extra = autoAllocate(ledger.outstandingCharges(tenancyId), ledger, ledger.unallocated(payment))
    if (extra.length) next = { ...next, payments: next.payments.map((item) => (item.id === id ? { ...item, allocations: [...item.allocations, ...extra] } : item)) }
  }
  return next
}

function noticeCompliance(tenancy: Tenancy, now: string): NoticeCompliance {
  const [endDateUsed, basis]: [string, NoticeCompliance['basis']] = tenancy.endDate ? [tenancy.endDate, 'ACTUAL_END'] : tenancy.expectedEndDate ? [tenancy.expectedEndDate, 'EXPECTED_END'] : [now, 'TODAY']
  const requiredNoticeDays = tenancy.noticePeriodDays
  if (!tenancy.noticeDate) return { status: 'NO_NOTICE', requiredNoticeDays, noticeDate: null, daysGiven: null, shortfallDays: requiredNoticeDays, endDateUsed, basis }
  const daysGiven = daysBetween(tenancy.noticeDate, endDateUsed)
  return { status: daysGiven >= requiredNoticeDays ? 'PROPER_NOTICE' : 'SHORT_NOTICE', requiredNoticeDays, noticeDate: tenancy.noticeDate, daysGiven, shortfallDays: Math.max(0, requiredNoticeDays - daysGiven), endDateUsed, basis }
}

/** Same shape and arithmetic as GET settlements/tenancy/:id/preview. */
export function buildSettlementPreview(state: BillingState, tenancyId: string, now = today()): SettlementPreview {
  const tenancy = findTenancy(state, tenancyId)
  const ledger = buildLedger(state)
  const lines = ledger.liveCharges.filter((charge) => charge.tenancyId === tenancyId && isDeposit(charge.type))
    .map((charge) => ({ chargeId: charge.id, type: charge.type, charged: charge.amount, paid: ledger.paidOn(charge), outstanding: ledger.outstandingOn(charge) }))
  const held = lines.reduce((sum, line) => sum + line.paid, 0)
  const charged = lines.reduce((sum, line) => sum + line.charged, 0)
  const outstanding = ledger.outstandingCharges(tenancyId)
  const suggestedDeductions = outstanding.filter((charge) => !isDeposit(charge.type)).map((charge) => ({
    chargeId: charge.id,
    type: charge.type,
    periodMonth: charge.period ? `${charge.period}-01` : null,
    reason: `${chargeTypes[charge.type].label} arrears${charge.period ? ` for ${charge.period}` : ''}`,
    amount: ledger.outstandingOn(charge),
  }))
  const arrearsTotal = suggestedDeductions.reduce((sum, line) => sum + line.amount, 0)
  const settled = state.settlements.some((item) => item.tenancyId === tenancyId)
  return {
    tenancyId,
    tenancyStatus: tenancy.status === 'VACATED' ? 'VACATED' : tenancy.noticeDate ? 'NOTICE_GIVEN' : 'ACTIVE',
    canSettle: tenancy.status === 'VACATED' && !settled,
    alreadySettled: settled,
    deposit: { agreed: tenancy.depositRequired, charged, held, neverPaid: charged - held, lines },
    arrears: { total: arrearsTotal, charges: suggestedDeductions },
    totalOutstandingIncludingDeposit: outstanding.reduce((sum, charge) => sum + ledger.outstandingOn(charge), 0),
    unallocatedCredit: ledger.paymentsFor(tenancyId).reduce((sum, payment) => sum + ledger.unallocated(payment), 0),
    suggestedDeductions,
    suggestedRefundAmount: Math.max(0, held - arrearsTotal),
    noticeCompliance: noticeCompliance(tenancy, now),
  }
}

/** Saves the landlord's deposit decision. Lines naming a charge are paid from the deposit with an internal payment. */
export function recordSettlement(state: BillingState, tenancyId: string, input: SettlementInput): BillingState {
  if (findTenancy(state, tenancyId).status !== 'VACATED') throw new Error('A deposit can only be settled once the tenant has actually vacated')
  if (state.settlements.some((item) => item.tenancyId === tenancyId)) throw new Error('A deposit settlement has already been recorded for this tenancy')
  const preview = buildSettlementPreview(state, tenancyId)
  if (input.refundAmount > preview.deposit.held) throw new Error(`Refund of ${input.refundAmount} exceeds the ${preview.deposit.held} actually received as deposit for this tenancy`)
  const deductions = input.deductions ?? []
  const paidFromDeposit = new Map<string, number>()
  deductions.forEach(({ chargeId, amount }) => {
    if (!chargeId) return
    const owed = preview.suggestedDeductions.find((line) => line.chargeId === chargeId)?.amount
    if (owed === undefined) throw new Error(`Charge ${chargeId} is not an outstanding charge on this tenancy`)
    const total = (paidFromDeposit.get(chargeId) ?? 0) + amount
    if (total > owed) throw new Error(`Deductions against charge ${chargeId} total more than its outstanding balance of ${owed}`)
    paidFromDeposit.set(chargeId, total)
  })

  const [id, withId] = nextId(state, 'settlement')
  const settlement: Settlement = { id, tenancyId, depositHeld: preview.deposit.held, refundAmount: input.refundAmount, refundDate: input.refundDate ?? null, method: input.method ?? null, notes: input.notes ?? '', deductions: deductions.map(({ reason, amount }) => ({ reason, amount })), createdAt: today() }
  const next: BillingState = { ...withId, settlements: [...withId.settlements, settlement] }
  if (!paidFromDeposit.size) return next
  const allocations = [...paidFromDeposit.entries()].map(([chargeId, amount]) => ({ chargeId, amount }))
  return recordPayment(next, { tenancyId, amount: allocations.reduce((sum, item) => sum + item.amount, 0), paidAt: input.refundDate ?? today(), method: 'OTHER', reference: '', notes: `Settled from deposit — refund ${id}`, allocations }).state
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
  let state: BillingState = { tenancies: [], charges: [], payments: [], readings: [], settlements: [], settings: { waterRate: 150, garbageFee: 500, rentDueDay: 5 }, seq: 0 }

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
  state = vacate(state, david, { actualEndDate: day(p2, 28), moveOutReason: 'Moved to his own house', houseStatusAfter: 'VACANT' })

  // Last month: Mary and Lucy pay part, Peter gives notice and pays nothing.
  state = giveNotice(state, peter, { noticeDate: day(p1, 20), expectedEndDate: day(p0, 10), reason: 'Relocating for work' })
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
    noticePeriodDays: tenancy.noticePeriodDays ?? DEFAULT_NOTICE_DAYS,
    noticeDate: tenancy.noticeDate ? dayOf(tenancy.noticeDate) : null,
    expectedEndDate: tenancy.expectedEndDate ? dayOf(tenancy.expectedEndDate) : null,
    moveOutReason: tenancy.moveOutReason ?? '',
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

/** Only the tenancies of these houses, and the charges, payments, readings and settlements that hang off them. */
function scopeToHouses(state: BillingState, houseIds: Set<string>): BillingState {
  const tenancies = state.tenancies.filter((tenancy) => houseIds.has(tenancy.houseId))
  const ids = new Set(tenancies.map((tenancy) => tenancy.id))
  const own = <T extends { tenancyId: string }>(items: T[]) => items.filter((item) => ids.has(item.tenancyId))
  return { ...state, tenancies, charges: own(state.charges), payments: own(state.payments), readings: own(state.readings), settlements: own(state.settlements) }
}

// ─── Hook ────────────────────────────────────────────────────────────────

const BILLING_KEY = 'demo-billing'
const EMPTY: BillingState = { tenancies: [], charges: [], payments: [], readings: [], settlements: [], settings: DEFAULT_SETTINGS, seq: 0 }

/** Billing from the API when it is reachable, otherwise editable demo data. Both expose the same actions. */
export function useBilling() {
  const { mutate } = useSWRConfig()
  const source = useDataSource()
  const { data: houses } = useSWR('houses', () => api.houses())
  const { data: properties, mutate: refreshProperties } = useSWR(source === 'api' ? 'properties' : null, api.properties)
  const live = useSWR(source === 'api' && houses ? ['billing', houses.map((house) => house.id).join(',')] : null, () => loadLiveBilling(houses!))
  const demo = useSWR<BillingState>(BILLING_KEY, null, { fallbackData: seed })
  const local = useSWR<BillingSettings>('billing-settings', null, { fallbackData: DEFAULT_SETTINGS })
  const { data: demoHouseList } = useSWR<House[]>('demo-houses', null, { fallbackData: demoHouses })
  const { scopeId, current: currentProperty } = usePropertyScope()

  useEffect(() => { local.mutate(readLocalSettings(), { revalidate: false }) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // The water rate is the switched-to property's; with "All properties" it is the first one's.
  const property = (currentProperty && properties?.find((item) => item.id === currentProperty.id)) ?? properties?.[0]
  const mode: 'live' | 'demo' | 'error' | 'loading' = source === 'demo' ? 'demo' : live.data ? 'live' : live.error ? 'error' : 'loading'

  const fullState = useMemo<BillingState>(() => {
    if (mode === 'demo') return demo.data ?? seed
    if (mode !== 'live') return EMPTY
    const settings = { ...(local.data ?? DEFAULT_SETTINGS), waterRate: property ? Number(property.defaultWaterRate) || DEFAULT_SETTINGS.waterRate : (local.data ?? DEFAULT_SETTINGS).waterRate }
    // Rent the API generates has no due date; it falls due on the landlord's rent day.
    const charges = live.data!.charges.map((charge) => ({ ...charge, dueDate: charge.dueDate ?? (charge.period ? dueDate(charge.period, settings.rentDueDay) : charge.createdAt) }))
    // Live settlements are read per tenancy from the preview endpoint (lib/move-out.ts), so none are kept here.
    return { ...live.data!, charges, settlements: [], settings, seq: 0 }
  }, [mode, demo.data, live.data, local.data, property])

  // Everything is loaded once; switching property only narrows what the pages see.
  const state = useMemo(() => {
    if (scopeId === ALL_PROPERTIES) return fullState
    const houseList: { id: string; propertyId: string }[] = (mode === 'demo' ? demoHouseList : houses) ?? []
    return scopeToHouses(fullState, new Set(houseList.filter((house) => house.propertyId === scopeId).map((house) => house.id)))
  }, [fullState, scopeId, mode, demoHouseList, houses])

  const ledger = useMemo(() => buildLedger(state), [state])

  const applyDemo = async <T,>(change: (current: BillingState) => { state: BillingState; result: T }) => {
    const { state: next, result } = change(demo.data ?? seed)
    await demo.mutate(next, { revalidate: false })
    return result
  }
  const requireLive = () => { if (mode !== 'live') throw live.error ?? new Error('Billing is still loading. Try again in a moment.') }
  const refresh = () => live.mutate()
  // Notice and vacate also change the house (and vacate makes the tenant a former tenant), so those lists follow.
  const refreshHousesAndTenants = () => Promise.all([mutate('houses'), mutate('tenants'), refresh()])
  const updateDemoHouse = (houseId: string, change: Partial<House>) =>
    mutate<House[]>('demo-houses', (current = demoHouses) => current.map((house) => (house.id === houseId ? { ...house, ...change } : house)), { revalidate: false })

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

    async giveNotice(tenancyId: string, input: NoticeInput) {
      if (mode === 'demo') {
        await applyDemo((s) => ({ state: giveNotice(s, tenancyId, input), result: undefined }))
        await updateDemoHouse(findTenancy(state, tenancyId).houseId, { status: 'NOTICE_GIVEN' })
        return
      }
      requireLive()
      await api.giveNotice(tenancyId, input)
      await refreshHousesAndTenants()
    },

    /** Ends the tenancy and returns the settlement preview the API works out in the same step. */
    async vacate(tenancyId: string, input: VacateInput): Promise<SettlementPreview> {
      if (mode === 'demo') {
        const tenancy = findTenancy(state, tenancyId)
        const preview = await applyDemo((s) => { const next = vacate(s, tenancyId, input); return { state: next, result: buildSettlementPreview(next, tenancyId) } })
        await updateDemoHouse(tenancy.houseId, { status: input.houseStatusAfter, tenant: null })
        await mutate<Tenant[]>('demo-tenants', (current = demoTenants) => current.map((tenant) => (tenant.id === tenancy.tenantId ? { ...tenant, status: 'FORMER' } : tenant)), { revalidate: false })
        return preview
      }
      requireLive()
      const { settlementPreview } = await api.vacate(tenancyId, input)
      await Promise.all([refreshHousesAndTenants(), mutate(['settlement-preview', tenancyId], settlementPreview, { revalidate: false })])
      return settlementPreview
    },

    async recordSettlement(tenancyId: string, input: SettlementInput) {
      if (mode === 'demo') return applyDemo((s) => ({ state: recordSettlement(s, tenancyId, input), result: undefined }))
      requireLive()
      await api.recordSettlement(tenancyId, input)
      await Promise.all([refresh(), mutate((key) => Array.isArray(key) && (String(key[0]).startsWith('settlement-preview') || key[0] === 'balance'))])
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
