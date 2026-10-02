import { cn } from '@/lib/utils'

export function FilterChip({ active, onClick, label, count, dotClass }: { active: boolean; onClick: () => void; label: string; count: number; dotClass?: string }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={cn('flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors', active ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400')}>
      {dotClass && <span className={cn('size-2 rounded-full ring-2', dotClass)} />}
      {label}
      <span className={cn('tabular-nums', active ? 'text-white/70' : 'text-slate-400')}>{count}</span>
    </button>
  )
}
