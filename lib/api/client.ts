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

export type Property = { id: string; name?: string; address?: string; unitsCount?: number }
export type ApiHouse = { id: string; propertyId: string; unitNumber: string; houseType?: string; status?: string; defaultMonthlyRent?: number; defaultDepositAmount?: number; waterMeterNumber?: string; electricityMeterNumber?: string }
export type ApiTenant = { id: string; fullName: string; phone?: string; email?: string; active?: boolean; houseId?: string }
export type ApiPayment = { id: string; tenancyId?: string; amount: number; paidAt: string; method?: string; reference?: string }

export const api = {
  properties: () => apiFetch<Property[]>('/properties'),
  houses: (propertyId?: string) => apiFetch<ApiHouse[]>(propertyId ? `/houses/property/${encodeURIComponent(propertyId)}` : '/houses'),
  tenants: () => apiFetch<ApiTenant[]>('/tenants'),
  payments: () => apiFetch<ApiPayment[]>('/payments'),
  rentStatus: (month: string) => apiFetch<unknown[]>(`/rent/status?month=${encodeURIComponent(month)}`),
  arrears: () => apiFetch<unknown[]>('/arrears'),
  createPayment: (payload: { tenancyId: string; amount: number; paidAt: string; method: string; reference?: string }) => apiFetch<ApiPayment>('/payments', { method: 'POST', body: JSON.stringify(payload) }),
}
