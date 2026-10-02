'use client'

import { useState } from 'react'
import { formatCompactKsh, formatKsh, percent } from '@/lib/format'

// Chart colours: one accent hue for the measure that matters, a neutral track for context.
const ACCENT = '#2a78d6'
const TRACK = '#e2e8f0'
const GRID = '#eef2f6'

/** Rounds a maximum up to a clean axis value whose quarters are also clean (e.g. 120k → 30k steps). */
function niceMax(value: number) {
  if (value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  const step = [1, 1.2, 1.6, 2, 2.4, 3.2, 4, 6, 8, 10].find((multiple) => multiple * power >= value) ?? 10
  return step * power
}

export type TrendPoint = { label: string; billed: number; collected: number }

/** Columns of collected money set against what was billed, one per month. */
export function CollectionTrendChart({ data, height = 220 }: { data: TrendPoint[]; height?: number }) {
  const [active, setActive] = useState<number | null>(null)
  const max = niceMax(Math.max(...data.map((point) => Math.max(point.billed, point.collected))))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((share) => share * max)
  const last = data.length - 1

  return (
    <figure className="m-0">
      <figcaption className="mb-7 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: ACCENT }} />Collected</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: TRACK }} />Billed</span>
      </figcaption>
      <div className="flex gap-3">
        <div className="relative w-14 shrink-0 text-right text-[11px] text-slate-400" style={{ height }} aria-hidden>
          {ticks.map((tick) => <span key={tick} className="absolute right-0 -translate-y-1/2 tabular-nums" style={{ bottom: `${(tick / max) * 100}%` }}>{formatCompactKsh(tick)}</span>)}
        </div>
        <div className="relative flex-1" style={{ height }}>
          {ticks.map((tick) => <div key={tick} className="absolute inset-x-0 h-px" style={{ bottom: `${(tick / max) * 100}%`, background: tick === 0 ? '#cbd5e1' : GRID }} />)}
          <div className="absolute inset-0 flex items-end justify-around">
            {data.map((point, index) => {
              const rate = percent(point.collected, point.billed)
              return (
                <div
                  key={point.label}
                  tabIndex={0}
                  role="img"
                  aria-label={`${point.label}: collected ${formatKsh(point.collected)} of ${formatKsh(point.billed)} billed (${rate}%)`}
                  onPointerEnter={() => setActive(index)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                  className="relative flex h-full flex-1 cursor-default items-end justify-center outline-none focus-visible:bg-slate-50"
                >
                  <div className="relative w-6" style={{ height: `${(point.billed / max) * 100}%` }}>
                    <div className="absolute inset-0 rounded-t" style={{ background: TRACK }} />
                    <div className="absolute inset-x-0 bottom-0 rounded-t" style={{ height: `${point.billed ? (point.collected / point.billed) * 100 : 0}%`, background: ACCENT }} />
                    {index === last && <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold text-slate-700">{rate}%</span>}
                  </div>
                  {active === index && (
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-44 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-lg" role="tooltip">
                      <p className="font-semibold text-slate-900">{point.label}</p>
                      <p className="mt-1.5 flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-slate-500"><span className="h-0.5 w-3" style={{ background: ACCENT }} />Collected</span><b className="tabular-nums text-slate-900">{formatKsh(point.collected)}</b></p>
                      <p className="mt-1 flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-slate-500"><span className="h-0.5 w-3" style={{ background: '#94a3b8' }} />Billed</span><b className="tabular-nums text-slate-900">{formatKsh(point.billed)}</b></p>
                      <p className="mt-1 text-slate-500">{rate}% collected</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div className="ml-[4.25rem] mt-2 flex justify-around text-[11px] text-slate-500" aria-hidden>
        {data.map((point) => <span key={point.label} className="flex-1 text-center">{point.label}</span>)}
      </div>
    </figure>
  )
}

/** Horizontal bars for comparing a few amounts, largest first. */
export function BarList({ items, format = formatKsh }: { items: { label: string; value: number; detail?: string }[]; format?: (value: number) => string }) {
  const sorted = [...items].sort((a, b) => b.value - a.value)
  const max = Math.max(1, ...sorted.map((item) => item.value))
  return (
    <ul className="flex flex-col gap-3">
      {sorted.map((item) => (
        <li key={item.label} className="grid grid-cols-[6rem_1fr] items-center gap-3 text-sm" title={`${item.label}: ${format(item.value)}${item.detail ? ` · ${item.detail}` : ''}`}>
          <span className="truncate text-slate-600">{item.label}</span>
          <span className="flex items-center gap-2">
            <span className="h-5 rounded-r" style={{ width: `${Math.max(item.value ? 2 : 0, (item.value / max) * 80)}%`, background: ACCENT }} />
            <span className="whitespace-nowrap text-xs tabular-nums text-slate-700"><b className="font-semibold">{format(item.value)}</b>{item.detail && <span className="text-slate-400"> · {item.detail}</span>}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
