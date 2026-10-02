// Typed client for the Renters API (NestJS, /api/v1).
// Requests go to /api/v1 on this app; app/api/v1/[...path]/route.ts forwards them to the API
// with the signed-in user's Kinde access token.

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api/v1').replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  body: unknown
  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export const isAuthError = (error: unknown) => error instanceof ApiError && error.status === 401

/** Nest error bodies carry `message` as a string, a list of validation messages, or a nested object (409 duplicates). */
function readMessage(body: unknown, status: number) {
  const raw = (body as { message?: unknown } | null)?.message
  const message = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw.join('. ') : (raw as { message?: string } | undefined)?.message
  if (status === 401) return 'The API didn’t accept your sign-in.'
  return message ?? 'Something went wrong. Please try again.'
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new ApiError(readMessage(body, response.status), response.status, body)
  }
  return response.json() as Promise<T>
}

// Prisma serialises Decimal columns as strings, so money fields may arrive either way.
type Money = number | string
type IsoDate = string

export type Property = { id: string; name: string; address: string; location?: string | null; defaultWaterRate: Money; currency: string; ownerId: string }

export type HouseStatus = 'VACANT' | 'OCCUPIED' | 'RESERVED' | 'NOTICE_GIVEN' | 'MAINTENANCE' | 'INACTIVE'
export type ApiHouse = {
  id: string
  propertyId: string
  unitNumber: string
  houseType?: string | null
  status: HouseStatus
  defaultMonthlyRent: Money
  defaultDepositAmount?: Money | null
  waterMeterNumber?: string | null
  metadata?: unknown
  notes?: string | null
  tenancies?: { id: string; tenant: { fullName: string; phone?: string } }[]
}
export type HouseInput = { unitNumber: string; houseType?: string; waterMeterNumber?: string; defaultMonthlyRent: number; defaultDepositAmount?: number; notes?: string; metadata?: string }

export type TenantStatus = 'ACTIVE' | 'FORMER'
export type ApiTenant = {
  id: string
  fullName: string
  phone: string
  altPhone?: string | null
  nationalId?: string | null
  email?: string | null
  occupation?: string | null
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
  status: TenantStatus
}
// Optional fields are sent as null when blank so an edit can clear them (and '' would fail email validation).
export type TenantInput = { fullName: string; phone: string } & { [K in 'altPhone' | 'nationalId' | 'email' | 'occupation' | 'emergencyContactName' | 'emergencyContactPhone']?: string | null }

export type ApiTenancy = {
  id: string
  houseId: string
  tenantId: string
  monthlyRent: Money
  depositRequired: Money
  startDate: IsoDate
  expectedEndDate?: IsoDate | null
  actualEndDate?: IsoDate | null
  openingWaterReading?: Money | null
  status: 'ACTIVE' | 'NOTICE_GIVEN' | 'VACATED'
  tenant?: ApiTenant
}
export type MoveInInput = { houseId: string; tenantId: string; monthlyRent: number; depositRequired?: number; startDate: string; openingWaterReading?: number }

export type ApiChargeType = 'RENT' | 'WATER' | 'RENTDEPOSIT' | 'WATERDEPOSIT' | 'TRASH' | 'TRASHDEPOSIT' | 'SECURITYDEPOSIT' | 'SECURITY' | 'SERVICEFEE' | 'OTHER'
export type ApiCharge = { id: string; tenancyId: string; type: ApiChargeType; periodMonth: IsoDate | null; amount: Money; description: string | null; dueDate: IsoDate | null; voidedAt: IsoDate | null; createdAt: IsoDate }
export type ChargeInput = { tenancyId: string; type: ApiChargeType; amount: number; periodMonth?: string; description?: string; dueDate?: string }

export type ApiPaymentMethod = 'MPESA' | 'BANK' | 'CASH' | 'OTHER'
export type ApiPayment = {
  id: string
  tenancyId: string
  amount: Money
  paidAt: IsoDate
  method: ApiPaymentMethod
  reference: string | null
  notes: string | null
  voidedAt: IsoDate | null
  voidReason: string | null
  allocations: { chargeId: string; amount: Money }[]
}
export type PaymentInput = { tenancyId: string; amount: number; paidAt: string; method: ApiPaymentMethod; reference?: string; notes?: string; allocations?: { chargeId: string; amount: number }[]; confirmDuplicate?: boolean }

export type ApiBalance = { tenancyId: string; byType: Partial<Record<ApiChargeType, number>>; total: number; isCleared: boolean }

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) })
const id = encodeURIComponent

export const api = {
  properties: () => apiFetch<Property[]>('/properties'),
  updateProperty: (propertyId: string, payload: { defaultWaterRate?: number }) => apiFetch<Property>(`/properties/property/${id(propertyId)}`, json('PATCH', payload)),

  houses: (propertyId?: string) => apiFetch<ApiHouse[]>(propertyId ? `/houses/property/${id(propertyId)}` : '/houses'),
  createHouse: (payload: HouseInput & { propertyId: string }) => apiFetch<ApiHouse>('/houses', json('POST', payload)),
  updateHouse: (houseId: string, payload: Partial<HouseInput>) => apiFetch<ApiHouse>(`/houses/house/${id(houseId)}`, json('PATCH', payload)),
  changeHouseStatus: (houseId: string, status: HouseStatus, reason?: string) => apiFetch<ApiHouse>(`/houses/house/${id(houseId)}/status`, json('PATCH', { status, reason })),

  tenants: () => apiFetch<ApiTenant[]>('/tenants'),
  createTenant: (payload: TenantInput) => apiFetch<ApiTenant>('/tenants', json('POST', payload)),
  updateTenant: (tenantId: string, payload: TenantInput) => apiFetch<ApiTenant>(`/tenants/tenant/${id(tenantId)}`, json('PATCH', payload)),
  deleteTenant: (tenantId: string) => apiFetch<ApiTenant>(`/tenants/tenant/${id(tenantId)}`, { method: 'DELETE' }),

  tenanciesForHouse: (houseId: string) => apiFetch<ApiTenancy[]>(`/tenancies/house/${id(houseId)}`),
  activeTenancy: (houseId: string) => apiFetch<ApiTenancy>(`/tenancies/house/${id(houseId)}/active`),
  balance: (tenancyId: string) => apiFetch<ApiBalance>(`/tenancies/tenancy/${id(tenancyId)}/balance`),
  moveIn: (payload: MoveInInput) => apiFetch<ApiTenancy>('/tenancies/move-in', json('POST', payload)),
  // NOTE: the API has no move-out endpoint yet; this is the route the UI expects once it exists.
  moveOut: (tenancyId: string, payload: { actualEndDate: string; moveOutReason?: string }) => apiFetch<ApiTenancy>(`/tenancies/tenancy/${id(tenancyId)}/move-out`, json('POST', payload)),

  charges: (tenancyId: string) => apiFetch<ApiCharge[]>(`/charges?tenancyId=${id(tenancyId)}`),
  createCharge: (payload: ChargeInput) => apiFetch<ApiCharge>('/charges', json('POST', payload)),
  voidCharge: (chargeId: string, reason: string) => apiFetch<ApiCharge>(`/charges/charge/${id(chargeId)}/void`, json('PATCH', { reason })),
  generateRent: (month: string) => apiFetch<{ generated: number; skipped: number }>('/rent/generate', json('POST', { month })),

  payments: (tenancyId: string) => apiFetch<ApiPayment[]>(`/payments?tenancyId=${id(tenancyId)}`),
  recordPayment: (payload: PaymentInput) => apiFetch<ApiPayment>('/payments', json('POST', payload)),
  voidPayment: (paymentId: string, reason: string) => apiFetch<ApiPayment>(`/payments/payment/${id(paymentId)}/void`, json('PATCH', { reason })),
}
