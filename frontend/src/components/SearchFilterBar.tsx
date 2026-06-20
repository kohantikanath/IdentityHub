import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { useDebounce } from '../hooks/useDebounce'
import { useMeta } from '../hooks/useUsers'

interface SearchFilterBarProps {
  search: string
  place: string
  dobFrom: string
  dobTo: string
  nameSort: 'asc' | 'desc' | ''
  onSearch: (value: string) => void
  onFilter: (place: string, dobFrom: string, dobTo: string) => void
  onNameSort: (order: 'asc' | 'desc' | '') => void
}

export default function SearchFilterBar({ search, place, dobFrom, dobTo, nameSort, onSearch, onFilter, onNameSort }: SearchFilterBarProps) {
  const { data: meta } = useMeta()
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [localSearch, setLocalSearch] = useState(search)
  const debouncedSearch = useDebounce(localSearch, 350)

  const [open, setOpen]             = useState(false)
  const [localPlace, setLocalPlace]     = useState(place)
  const [localDobFrom, setLocalDobFrom] = useState(dobFrom)
  const [localDobTo, setLocalDobTo]     = useState(dobTo)

  // Skip first render so mounting doesn't fire an empty search and reset page
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    onSearch(debouncedSearch)
  }, [debouncedSearch])

  // Keep local state in sync when parent resets (chip removal, clear)
  useEffect(() => { setLocalSearch(search) },   [search])
  useEffect(() => { setLocalPlace(place) },     [place])
  useEffect(() => { setLocalDobFrom(dobFrom) }, [dobFrom])
  useEffect(() => { setLocalDobTo(dobTo) },     [dobTo])

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const applyFilters = () => { onFilter(localPlace, localDobFrom, localDobTo); setOpen(false) }
  const resetFilters = () => {
    setLocalPlace(''); setLocalDobFrom(''); setLocalDobTo('')
    onFilter('', '', ''); onNameSort(''); setOpen(false)
  }

  const activeCount = [place, (dobFrom || dobTo), nameSort].filter(Boolean).length
  const hasChips    = !!(place || dobFrom || dobTo)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-8 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white placeholder-gray-400"
          />
          {localSearch && (
            <button onClick={() => setLocalSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filters dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen((o) => !o)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm border rounded-lg transition-colors whitespace-nowrap ${
              activeCount > 0 ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Filters
            {activeCount > 0 && (
              <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                {activeCount}
              </span>
            )}
            <ChevronDown size={14} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-1.5 z-20 bg-white border border-gray-200 rounded-xl shadow-xl p-4 w-72 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Place of Birth</label>
                <select
                  value={localPlace}
                  onChange={(e) => setLocalPlace(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
                >
                  <option value="">All places</option>
                  {meta?.places_of_birth.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date of Birth (Year)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number" value={localDobFrom}
                    onChange={(e) => setLocalDobFrom(e.target.value)}
                    placeholder="From" min={1900} max={2024}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-gray-400 shrink-0">–</span>
                  <input
                    type="number" value={localDobTo}
                    onChange={(e) => setLocalDobTo(e.target.value)}
                    placeholder="To" min={1900} max={2024}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Sort by Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sort by Name</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => { onNameSort(nameSort === 'asc' ? '' : 'asc'); setOpen(false) }}
                    className={`flex-1 py-2 text-sm border rounded-lg transition-colors ${
                      nameSort === 'asc' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    A → Z
                  </button>
                  <button
                    onClick={() => { onNameSort(nameSort === 'desc' ? '' : 'desc'); setOpen(false) }}
                    className={`flex-1 py-2 text-sm border rounded-lg transition-colors ${
                      nameSort === 'desc' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Z → A
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-1 border-t border-gray-100">
                <button onClick={resetFilters} className="flex-1 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  Reset
                </button>
                <button onClick={applyFilters} className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active chips */}
      {hasChips && (
        <div className="flex flex-wrap gap-2">
          {place && <Chip label={`Place: ${place}`} onRemove={() => onFilter('', dobFrom, dobTo)} />}
          {(dobFrom || dobTo) && (
            <Chip label={`Born: ${dobFrom || '…'} – ${dobTo || '…'}`} onRemove={() => onFilter(place, '', '')} />
          )}
        </div>
      )}
    </div>
  )
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-full border border-blue-200">
      {label}
      <button onClick={onRemove} className="hover:text-blue-900 leading-none"><X size={11} /></button>
    </span>
  )
}
