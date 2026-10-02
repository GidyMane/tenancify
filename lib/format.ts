// Money, date, and billing-period helpers shared by every module.
// A billing period is a calendar month written as 'YYYY-MM'.

export const formatKsh = (amount: number) => `KSh ${Math.round(amount).toLocaleString('en-KE')}`

export const formatCompactKsh = (amount: number) =>
  amount >= 1_000_000 ? `KSh ${(amount / 1_000_000).toFixed(1)}M` : amount >= 10_000 ? `KSh ${Math.round(amount / 1000)}k` : formatKsh(amount)

export const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

const pad = (value: number) => String(value).padStart(2, '0')

export const today = () => {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export const currentPeriod = () => today().slice(0, 7)

export const addMonths = (period: string, months: number) => {
  const [year, month] = period.split('-').map(Number)
  const date = new Date(year, month - 1 + months, 1)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

export const periodOf = (isoDate: string) => isoDate.slice(0, 7)

export const periodLabel = (period: string, style: 'long' | 'short' = 'long') => {
  const [year, month] = period.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-KE', { month: style, year: 'numeric' })
}

export const formatDate = (isoDate: string) => {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const daysBetween = (fromIso: string, toIso: string) =>
  Math.round((Date.parse(toIso.slice(0, 10)) - Date.parse(fromIso.slice(0, 10))) / 86_400_000)

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
