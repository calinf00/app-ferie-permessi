'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from '@/components/icons'

type Request = {
  id: string
  start_date: string
  end_date: string
  hours: number | null
  status: string
  notes: string | null
  leave_types: { name: string; color: string } | null
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'In attesa',
  approved: 'Confermata',
  rejected: 'Non confermata',
  cancellation_requested: 'Annullamento richiesto',
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border border-amber-100',
  approved: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  rejected: 'bg-red-50 text-red-600 border border-red-100',
  cancellation_requested: 'bg-orange-50 text-orange-700 border border-orange-100',
}

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
const MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

// Parse a 'YYYY-MM-DD' string into a local Date (avoids timezone shifts).
function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

// Local 'YYYY-MM-DD' key for a Date.
function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Monday-first weekday index (0 = Lun ... 6 = Dom).
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7
}

function formatFullDate(s: string): string {
  return parseDate(s).toLocaleDateString('it-IT')
}

function durationLabel(req: Request): string {
  if (req.hours) return `${req.hours} ${req.hours === 1 ? 'ora' : 'ore'}`
  const days = Math.round((parseDate(req.end_date).getTime() - parseDate(req.start_date).getTime()) / 86400000) + 1
  return `${days} ${days === 1 ? 'giorno' : 'giorni'}`
}

export default function CalendarioComunicazioni({ requests }: { requests: Request[] }) {
  const today = new Date()
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  // Le comunicazioni rifiutate non vengono mostrate sul calendario.
  const visibleRequests = useMemo(
    () => requests.filter(r => r.status !== 'rejected'),
    [requests]
  )

  // Map of dateKey -> requests active that day.
  const requestsByDay = useMemo(() => {
    const map = new Map<string, Request[]>()
    for (const req of visibleRequests) {
      const start = parseDate(req.start_date)
      const end = parseDate(req.end_date)
      const cur = new Date(start)
      // Guard against malformed ranges (end before start).
      if (end < start) continue
      while (cur <= end) {
        const key = dateKey(cur)
        const list = map.get(key)
        if (list) list.push(req)
        else map.set(key, [req])
        cur.setDate(cur.getDate() + 1)
      }
    }
    return map
  }, [visibleRequests])

  // Build the grid: 6 weeks * 7 days, Monday-first.
  const cells = useMemo(() => {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const firstOfMonth = new Date(year, month, 1)
    const leading = mondayIndex(firstOfMonth)
    const gridStart = new Date(year, month, 1 - leading)

    const result: { date: Date; inMonth: boolean; key: string }[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart)
      d.setDate(gridStart.getDate() + i)
      result.push({ date: d, inMonth: d.getMonth() === month, key: dateKey(d) })
    }
    return result
  }, [cursor])

  const todayKey = dateKey(today)
  const selectedRequests = selectedKey ? requestsByDay.get(selectedKey) ?? [] : []

  function goPrev() {
    setCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1))
    setSelectedKey(null)
  }
  function goNext() {
    setCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1))
    setSelectedKey(null)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goPrev}
          aria-label="Mese precedente"
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className="font-semibold text-gray-900 text-sm">
          {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
        </h3>
        <button
          onClick={goNext}
          aria-label="Mese successivo"
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map(w => (
          <div key={w} className="text-center text-xs font-medium text-gray-400 py-1">
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 rounded-xl overflow-hidden border border-gray-100">
        {cells.map(cell => {
          const dayRequests = cell.inMonth ? requestsByDay.get(cell.key) ?? [] : []
          const isToday = cell.key === todayKey
          const isSelected = cell.key === selectedKey
          const hasRequests = dayRequests.length > 0
          const visible = dayRequests.slice(0, 2)
          const extra = dayRequests.length - visible.length

          return (
            <div
              key={cell.key}
              onClick={() => {
                if (hasRequests) setSelectedKey(isSelected ? null : cell.key)
              }}
              className={[
                'min-h-[72px] sm:min-h-[80px] border border-gray-50 p-1 flex flex-col gap-1',
                hasRequests ? 'cursor-pointer hover:bg-slate-50/60' : '',
                isSelected ? 'bg-slate-50' : '',
              ].join(' ')}
            >
              <div
                className={[
                  'text-xs self-start w-6 h-6 flex items-center justify-center rounded-full',
                  cell.inMonth ? 'text-gray-700' : 'text-gray-300',
                  isToday ? 'bg-slate-900 text-white font-semibold' : '',
                ].join(' ')}
              >
                {cell.date.getDate()}
              </div>

              {visible.map((req, i) => (
                <div
                  key={`${req.id}-${i}`}
                  title={`${req.leave_types?.name ?? ''} · ${durationLabel(req)}`}
                  className="text-[10px] leading-tight text-white rounded px-1 py-0.5 truncate"
                  style={{ backgroundColor: req.leave_types?.color || '#64748B' }}
                >
                  {req.leave_types?.name ?? 'Assenza'}
                </div>
              ))}
              {extra > 0 && (
                <div className="text-[10px] text-gray-500 px-1">+{extra}</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Detail panel */}
      {selectedKey && selectedRequests.length > 0 && (
        <div className="mt-5 border-t border-gray-100 pt-4">
          <p className="text-sm font-semibold text-gray-900 mb-3">
            {parseDate(selectedKey).toLocaleDateString('it-IT', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
          <div className="flex flex-col gap-2">
            {selectedRequests.map(req => (
              <div
                key={req.id}
                className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className="inline-block w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: req.leave_types?.color || '#64748B' }}
                    />
                    <span className="font-medium text-gray-900 text-sm">
                      {req.leave_types?.name ?? 'Assenza'}
                    </span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-400">{durationLabel(req)}</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {req.hours
                      ? formatFullDate(req.start_date)
                      : `${formatFullDate(req.start_date)} — ${formatFullDate(req.end_date)}`}
                  </p>
                  {req.notes && <p className="text-xs text-gray-400 mt-1">{req.notes}</p>}
                </div>
                <span
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap ${STATUS_STYLE[req.status] ?? 'bg-gray-100 text-gray-500'}`}
                >
                  {STATUS_LABEL[req.status] ?? req.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
