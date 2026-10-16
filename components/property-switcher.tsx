'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Building, Check, ChevronsUpDown, Layers, Settings2 } from 'lucide-react'
import { initials } from '@/lib/format'
import { useHouses } from '@/lib/houses'
import { ALL_PROPERTIES, usePropertyScope } from '@/lib/property-scope'
import { cn } from '@/lib/utils'

/** Sidebar control that picks which property the whole workspace shows. */
export function PropertySwitcher({ onManage }: { onManage: () => void }) {
  const { properties, current, scopeId, setScope } = usePropertyScope()
  const { allHouses } = useHouses()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false) }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('mousedown', closeOutside); document.removeEventListener('keydown', closeOnEscape) }
  }, [open])

  const unitsIn = (propertyId: string) => allHouses.filter((house) => house.propertyId === propertyId).length
  const units = (count: number) => `${count} unit${count === 1 ? '' : 's'}`

  // With nothing to switch between, the card just leads to the Properties page.
  if (properties.length < 2) {
    const only = properties[0]
    return (
      <button type="button" onClick={onManage} className="mt-8 flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3 text-left transition-colors hover:bg-slate-100">
        <Badge label={only?.name} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{only?.name ?? 'No property yet'}</p>
          <p className="truncate text-xs text-slate-400">{only ? [units(allHouses.length), only.address].filter(Boolean).join(' · ') : 'Add your first property'}</p>
        </div>
      </button>
    )
  }

  const choose = (id: string) => { setScope(id); setOpen(false) }

  return (
    <div ref={rootRef} className="relative mt-8">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-haspopup="listbox" aria-expanded={open} className="flex w-full items-center gap-3 rounded-xl bg-slate-50 px-3 py-3 text-left transition-colors hover:bg-slate-100">
        <Badge label={current?.name} all={!current} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{current?.name ?? 'All properties'}</p>
          <p className="truncate text-xs text-slate-400">{current ? units(unitsIn(current.id)) : `${properties.length} properties · ${units(allHouses.length)}`}</p>
        </div>
        <ChevronsUpDown className="size-4 shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <ul role="listbox" aria-label="Switch property" className="sidebar-scroll max-h-72 overflow-y-auto p-1">
            <Option selected={scopeId === ALL_PROPERTIES} onSelect={() => choose(ALL_PROPERTIES)} badge={<Badge all small />} name="All properties" detail={units(allHouses.length)} />
            {properties.map((property) => (
              <Option key={property.id} selected={scopeId === property.id} onSelect={() => choose(property.id)} badge={<Badge label={property.name} small />} name={property.name} detail={units(unitsIn(property.id))} />
            ))}
          </ul>
          <button type="button" onClick={() => { setOpen(false); onManage() }} className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-left text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900">
            <Settings2 className="size-3.5" />Manage properties
          </button>
        </div>
      )}
    </div>
  )
}

function Option({ selected, onSelect, badge, name, detail }: { selected: boolean; onSelect: () => void; badge: ReactNode; name: string; detail: string }) {
  return (
    <li role="option" aria-selected={selected}>
      <button type="button" onClick={onSelect} className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm', selected ? 'bg-slate-100 text-slate-950' : 'text-slate-700 hover:bg-slate-50')}>
        {badge}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{name}</span>
          <span className="block text-[11px] text-slate-400">{detail}</span>
        </span>
        {selected && <Check className="size-4 shrink-0 text-slate-900" />}
      </button>
    </li>
  )
}

function Badge({ label, all = false, small = false }: { label?: string; all?: boolean; small?: boolean }) {
  return (
    <div className={cn('flex shrink-0 items-center justify-center rounded-lg bg-white font-semibold text-slate-700 shadow-sm ring-1 ring-slate-100', small ? 'size-7 text-[11px]' : 'size-9 text-sm')}>
      {all ? <Layers className="size-4" /> : label ? initials(label) : <Building className="size-4" />}
    </div>
  )
}
