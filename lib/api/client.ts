const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1').replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include',
  })
  if (!response.ok) {
    let message = 'Something went wrong. Please try again.'
    try {
      const body = await response.json() as { message?: string }
      if (body.message) message = body.message
    } catch { /* Keep a safe user-facing fallback. */ }
    throw new ApiError(message, response.status)
  }
  return response.json() as Promise<T>
}

// Prisma serialises Decimal columns as strings, so money fields may arrive either way.
type Money = number | string

export type Property = { id: string; name?: string; address?: string; unitsCount?: number }
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
export type ApiTenancy = { id: string; houseId: string; tenantId: string; status: string; tenant?: ApiTenant }
export type MoveInInput = { houseId: string; tenantId: string; monthlyRent: number; depositRequired?: number; startDate: string }
export type ApiPayment = { id: string; tenancyId?: string; amount: number; paidAt: string; method?: string; reference?: string }

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) })
const id = encodeURIComponent

export const api = {
  properties: () => apiFetch<Property[]>('/properties'),
  houses: (propertyId?: string) => apiFetch<ApiHouse[]>(propertyId ? `/houses/property/${id(propertyId)}` : '/houses'),
  createHouse: (payload: HouseInput & { propertyId: string }) => apiFetch<ApiHouse>('/houses', json('POST', payload)),
  updateHouse: (houseId: string, payload: Partial<HouseInput>) => apiFetch<ApiHouse>(`/houses/house/${id(houseId)}`, json('PATCH', payload)),
  changeHouseStatus: (houseId: string, status: HouseStatus, reason?: string) => apiFetch<ApiHouse>(`/houses/house/${id(houseId)}/status`, json('PATCH', { status, reason })),
  tenants: () => apiFetch<ApiTenant[]>('/tenants'),
  createTenant: (payload: TenantInput) => apiFetch<ApiTenant>('/tenants', json('POST', payload)),
  updateTenant: (tenantId: string, payload: TenantInput) => apiFetch<ApiTenant>(`/tenants/tenant/${id(tenantId)}`, json('PATCH', payload)),
  deleteTenant: (tenantId: string) => apiFetch<ApiTenant>(`/tenants/tenant/${id(tenantId)}`, { method: 'DELETE' }),
  activeTenancy: (houseId: string) => apiFetch<ApiTenancy>(`/tenancies/house/${id(houseId)}/active`),
  moveIn: (payload: MoveInInput) => apiFetch<ApiTenancy>('/tenancies/move-in', json('POST', payload)),
  // NOTE: the backend does not expose a move-out endpoint yet; this is the route the UI expects.
  moveOut: (tenancyId: string, payload: { actualEndDate: string; moveOutReason?: string }) => apiFetch<ApiTenancy>(`/tenancies/tenancy/${id(tenancyId)}/move-out`, json('POST', payload)),
  payments: () => apiFetch<ApiPayment[]>('/payments'),
  rentStatus: (month: string) => apiFetch<unknown[]>(`/rent/status?month=${encodeURIComponent(month)}`),
  arrears: () => apiFetch<unknown[]>('/arrears'),
  createPayment: (payload: { tenancyId: string; amount: number; paidAt: string; method: string; reference?: string }) => apiFetch<ApiPayment>('/payments', { method: 'POST', body: JSON.stringify(payload) }),
}
