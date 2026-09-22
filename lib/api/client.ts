const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
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

export const api = {
  houses: () => apiFetch<unknown[]>('/houses'),
  tenants: () => apiFetch<unknown[]>('/tenants'),
  payments: () => apiFetch<unknown[]>('/payments'),
  rentStatus: (month: string) => apiFetch<unknown[]>(`/rent/status?month=${encodeURIComponent(month)}`),
  arrears: () => apiFetch<unknown[]>('/arrears'),
}
