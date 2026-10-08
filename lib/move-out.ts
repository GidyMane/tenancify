'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import { api, type DeductionInput, type SettlementPreview, type SuggestedDeduction } from '@/lib/api/client'
import { useAccounts } from '@/lib/accounts'
import { buildSettlementPreview, chargeTypes, onNotice, type ChargeType } from '@/lib/billing'
import { formatKsh, periodLabel } from '@/lib/format'

// Moving out runs notice (optional) → vacate → deposit settlement, all keyed by the tenancy id.

/** Tenancies on their way out, and the ones that have left but whose deposit is not settled yet. */
export function useMoveOuts() {
  const { accounts, state, mode } = useAccounts()

  const leaving = useMemo(() => accounts.filter(onNotice).sort((a, b) => (a.expectedEndDate ?? '').localeCompare(b.expectedEndDate ?? '')), [accounts])
  const vacated = useMemo(() => accounts.filter((account) => account.status === 'VACATED'), [accounts])

  // The API has no "unsettled" list, so each vacated tenancy's preview says whether it is settled.
  const ids = mode === 'live' ? vacated.map((account) => account.id) : []
  const live = useSWR(ids.length ? ['settlement-previews', ids.join(',')] : null, () => Promise.all(ids.map((id) => api.settlementPreview(id))))

  const toSettle = useMemo(() => {
    const previews: SettlementPreview[] = mode === 'demo' ? vacated.map((account) => buildSettlementPreview(state, account.id)) : live.data ?? []
    const byId = new Map(previews.map((preview) => [preview.tenancyId, preview]))
    return vacated.flatMap((account) => {
      const preview = byId.get(account.id)
      return preview?.canSettle ? [{ account, preview }] : []
    }).sort((a, b) => (b.account.endDate ?? '').localeCompare(a.account.endDate ?? ''))
  }, [mode, vacated, state, live.data])

  /** The tenancy of whoever lives in the house now (on notice or not). */
  const currentFor = (houseId: string) => accounts.find((account) => account.houseId === houseId && account.status === 'ACTIVE')

  return { leaving, toSettle, currentFor, ready: mode === 'live' || mode === 'demo', error: live.error as Error | undefined }
}

/** The preview for one tenancy: from the API, or worked out the same way from demo data. */
export function useSettlementPreview(tenancyId: string) {
  const { state, mode } = useAccounts()
  const live = useSWR(mode === 'live' ? ['settlement-preview', tenancyId] : null, () => api.settlementPreview(tenancyId))
  const demo = useMemo(() => (mode === 'demo' ? buildSettlementPreview(state, tenancyId) : undefined), [mode, state, tenancyId])
  return { preview: demo ?? live.data, error: live.error as Error | undefined }
}

/** Everything the tenant still owes, deposit included: GET tenancies/tenancy/:id/balance, or the demo ledger. */
export function useTenancyBalance(tenancyId: string) {
  const { ledger, mode } = useAccounts()
  const live = useSWR(mode === 'live' ? ['balance', tenancyId] : null, () => api.balance(tenancyId))
  return mode === 'demo' ? ledger.account(tenancyId).balance : live.data?.total
}

// ─── Deduction lines ────────────────────────────────────────────────────

/** `owed` is set on lines that pay a real charge from the deposit: the line can't take more than that. */
export type DeductionLine = { key: string; reason: string; amount: number; chargeId?: string; owed?: number }

let lineSeq = 0
export const newLine = (line: Omit<DeductionLine, 'key'>): DeductionLine => ({ ...line, key: `line-${++lineSeq}` })

const typeLabel = (type: ChargeType) => chargeTypes[type]?.label ?? 'Other'
const arrearsLabel = (line: Pick<SuggestedDeduction, 'type' | 'periodMonth'>) =>
  `${typeLabel(line.type)} arrears${line.periodMonth ? `, ${periodLabel(line.periodMonth.slice(0, 7))}` : ''}`

/**
 * The preview suggests every unpaid charge in full, even when that is more than the deposit holds.
 * Sending that would book a payment for money that never came in, so the deposit is spent on the
 * arrears in the API's own order (oldest rent first) and whatever it can't cover stays owed.
 */
export function suggestedLines(preview: SettlementPreview): DeductionLine[] {
  let remaining = preview.deposit.held
  return preview.suggestedDeductions.flatMap((suggestion) => {
    const amount = Math.min(remaining, suggestion.amount)
    remaining -= amount
    if (amount <= 0) return []
    const reason = `${arrearsLabel(suggestion)}${amount < suggestion.amount ? ` (part of ${formatKsh(suggestion.amount)})` : ''}`
    return [newLine({ reason, amount, chargeId: suggestion.chargeId, owed: suggestion.amount })]
  })
}

/** Daily rent for the days of notice the tenant fell short by; the landlord decides whether to add it. */
export function shortNoticeLine(preview: SettlementPreview, monthlyRent: number): DeductionLine | null {
  const { status, shortfallDays, daysGiven, requiredNoticeDays } = preview.noticeCompliance
  if (status === 'PROPER_NOTICE' || shortfallDays <= 0) return null
  const amount = Math.round((monthlyRent / 30) * shortfallDays)
  const reason = status === 'NO_NOTICE'
    ? `No notice given — ${shortfallDays} days' rent in lieu of notice`
    : `Short notice — ${daysGiven} of ${requiredNoticeDays} days given, ${shortfallDays} days' rent in lieu`
  return newLine({ reason, amount })
}

export const toDeductionInput = ({ reason, amount, chargeId }: DeductionLine): DeductionInput => ({ reason: reason.trim(), amount, ...(chargeId ? { chargeId } : {}) })
