'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Settings } from '@/components/icons'
import HolidayManager from './HolidayManager'

// --- Types ---
export type PresenzeProfile = {
  id: string
  full_name: string | null
  email: string
  team: string | null
  company: string | null
}

export type PresenzeRequest = {
  id: string
  start_date: string
  end_date: string
  hours: number | null
  user_id: string
  leave_types: { name: string; color: string } | null
}

export type Holiday = {
  id: string
  date: string
  name: string
}

type PeriodType = 'week' | 'month' | 'quarter' | 'year'

// --- Date utils ---
const IT_DAY_LETTERS = ['D', 'L', 'M', 'M', 'G', 'V', 'S']
const IT_MONTHS_FULL = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
const IT_MONTHS_SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseDateLocal(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d)
  r.setMonth(r.getMonth() + n)
  return r
}

function startOfISOWeek(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const r = new Date(d)
  r.setDate(d.getDate() + diff)
  r.setHours(0, 0, 0, 0)
  return r
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

function startOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3)
  return new Date(d.getFullYear(), q * 3, 1)
}

function endOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3)
  return new Date(d.getFullYear(), q * 3 + 3, 0)
}

function getDaysArray(start: Date, end: Date): Date[] {
  const days: Date[] = []
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  let c = new Date(s)
  while (c <= e) {
    days.push(new Date(c))
    c.setDate(c.getDate() + 1)
  }
  return days
}

function isWeekend(d: Date): boolean {
  return d.getDay() === 0 || d.getDay() === 6
}

function getPeriodBounds(anchor: Date, type: PeriodType): { start: Date; end: Date } {
  switch (type) {
    case 'week': {
      const s = startOfISOWeek(anchor)
      return { start: s, end: addDays(s, 6) }
    }
    case 'month':
      return { start: startOfMonth(anchor), end: endOfMonth(anchor) }
    case 'quarter':
      return { start: startOfQuarter(anchor), end: endOfQuarter(anchor) }
    case 'year':
      return { start: new Date(anchor.getFullYear(), 0, 1), end: new Date(anchor.getFullYear(), 11, 31) }
  }
}

function navigatePeriod(anchor: Date, type: PeriodType, dir: 1 | -1): Date {
  switch (type) {
    case 'week':    return addDays(anchor, 7 * dir)
    case 'month':   return addMonths(anchor, dir)
    case 'quarter': return addMonths(anchor, 3 * dir)
    case 'year':    return new Date(anchor.getFullYear() + dir, anchor.getMonth(), 1)
  }
}

function formatPeriodLabel(start: Date, end: Date, type: PeriodType): string {
  switch (type) {
    case 'week':
      if (start.getMonth() === end.getMonth())
        return `${start.getDate()} – ${end.getDate()} ${IT_MONTHS_FULL[start.getMonth()]} ${start.getFullYear()}`
      return `${start.getDate()} ${IT_MONTHS_SHORT[start.getMonth()]} – ${end.getDate()} ${IT_MONTHS_SHORT[end.getMonth()]} ${end.getFullYear()}`
    case 'month':
      return `${IT_MONTHS_FULL[start.getMonth()]} ${start.getFullYear()}`
    case 'quarter': {
      const q = Math.floor(start.getMonth() / 3) + 1
      return `T${q} ${start.getFullYear()} · ${IT_MONTHS_SHORT[start.getMonth()]} – ${IT_MONTHS_SHORT[end.getMonth()]}`
    }
    case 'year':
      return `${start.getFullYear()}`
  }
}

// --- Cell widths by period ---
const CELL_W: Record<PeriodType, number> = { week: 46, month: 32, quarter: 22, year: 58 }
const NAME_COL_W = 172

export default function AdminPresenzeGrid({
  profiles,
  requests,
  holidays: initialHolidays,
}: {
  profiles: PresenzeProfile[]
  requests: PresenzeRequest[]
  holidays: Holiday[]
}) {
  const [periodType, setPeriodType] = useState<PeriodType>('month')
  const [anchor, setAnchor] = useState(() => new Date())
  const [filterTeam, setFilterTeam] = useState('all')
  const [filterCompany, setFilterCompany] = useState('all')
  const [showOnlyAbsent, setShowOnlyAbsent] = useState(false)
  const [showHolidayManager, setShowHolidayManager] = useState(false)
  const [holidays, setHolidays] = useState(initialHolidays)

  const { start: periodStart, end: periodEnd } = useMemo(
    () => getPeriodBounds(anchor, periodType),
    [anchor, periodType]
  )

  const days = useMemo(
    () => periodType !== 'year' ? getDaysArray(periodStart, periodEnd) : [],
    [periodStart, periodEnd, periodType]
  )

  const yearMonths = useMemo(
    () => periodType === 'year' ? Array.from({ length: 12 }, (_, i) => new Date(anchor.getFullYear(), i, 1)) : [],
    [anchor, periodType]
  )

  // O(1) holiday lookups
  const holidaySet = useMemo(() => new Set(holidays.map(h => h.date)), [holidays])
  const holidayNames = useMemo(() => Object.fromEntries(holidays.map(h => [h.date, h.name])), [holidays])

  // Pre-compute absence lookup: userId → dateStr → request
  const absenceMap = useMemo(() => {
    const map = new Map<string, Map<string, PresenzeRequest>>()
    for (const r of requests) {
      if (!map.has(r.user_id)) map.set(r.user_id, new Map())
      const userMap = map.get(r.user_id)!
      const start = parseDateLocal(r.start_date)
      const end = parseDateLocal(r.end_date)
      let c = new Date(start)
      while (c <= end) {
        userMap.set(toDateStr(c), r)
        c.setDate(c.getDate() + 1)
      }
    }
    return map
  }, [requests])

  function getAbsence(userId: string, dateStr: string): PresenzeRequest | null {
    return absenceMap.get(userId)?.get(dateStr) ?? null
  }

  function getMonthSummary(userId: string, monthDate: Date): { days: number; color: string } | null {
    const y = monthDate.getFullYear()
    const m = monthDate.getMonth()
    const monthStartStr = toDateStr(new Date(y, m, 1))
    const monthEndStr = toDateStr(new Date(y, m + 1, 0))
    const userReqs = requests.filter(
      r => r.user_id === userId && r.start_date <= monthEndStr && r.end_date >= monthStartStr
    )
    if (userReqs.length === 0) return null
    let totalDays = 0
    for (const r of userReqs) {
      const s = new Date(Math.max(parseDateLocal(r.start_date).getTime(), new Date(y, m, 1).getTime()))
      const e = new Date(Math.min(parseDateLocal(r.end_date).getTime(), new Date(y, m + 1, 0).getTime()))
      totalDays += r.hours ? 0.5 : Math.round((e.getTime() - s.getTime()) / 86400000) + 1
    }
    return { days: totalDays, color: userReqs[0].leave_types?.color ?? '#94a3b8' }
  }

  const teams = useMemo(
    () => [...new Set(profiles.map(p => p.team).filter((t): t is string => !!t))].sort(),
    [profiles]
  )
  const companies = useMemo(
    () => [...new Set(profiles.map(p => p.company).filter((c): c is string => !!c))].sort(),
    [profiles]
  )

  const periodStartStr = toDateStr(periodStart)
  const periodEndStr = toDateStr(periodEnd)

  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      if (filterTeam !== 'all' && p.team !== filterTeam) return false
      if (filterCompany !== 'all' && p.company !== filterCompany) return false
      if (showOnlyAbsent) {
        const userMap = absenceMap.get(p.id)
        if (!userMap) return false
        const hasAbsence = [...userMap.keys()].some(d => d >= periodStartStr && d <= periodEndStr)
        if (!hasAbsence) return false
      }
      return true
    })
  }, [profiles, filterTeam, filterCompany, showOnlyAbsent, absenceMap, periodStartStr, periodEndStr])

  // Legend: leave types visible in current period
  const legendItems = useMemo(() => {
    const seen = new Map<string, string>()
    for (const r of requests) {
      if (r.start_date <= periodEndStr && r.end_date >= periodStartStr && r.leave_types) {
        seen.set(r.leave_types.name, r.leave_types.color)
      }
    }
    return [...seen.entries()]
  }, [requests, periodStartStr, periodEndStr])

  const todayStr = toDateStr(new Date())
  const cellW = CELL_W[periodType]
  const colCount = periodType === 'year' ? 12 : days.length

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Period type selector */}
        <div className="flex gap-0.5 bg-gray-100 p-1 rounded-xl">
          {(['week', 'month', 'quarter', 'year'] as PeriodType[]).map(t => (
            <button
              key={t}
              onClick={() => { setPeriodType(t); setAnchor(new Date()) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                periodType === t
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'week' ? 'Settimana' : t === 'month' ? 'Mese' : t === 'quarter' ? 'Trimestre' : 'Anno'}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setAnchor(a => navigatePeriod(a, periodType, -1))}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-gray-900 min-w-52 text-center select-none">
            {formatPeriodLabel(periodStart, periodEnd, periodType)}
          </span>
          <button
            onClick={() => setAnchor(a => navigatePeriod(a, periodType, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setAnchor(new Date())}
            className="ml-1 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Oggi
          </button>
        </div>

        {/* Filters */}
        {teams.length > 0 && (
          <select
            value={filterTeam}
            onChange={e => setFilterTeam(e.target.value)}
            className="text-sm text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-slate-400"
          >
            <option value="all">Tutti i team</option>
            {teams.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        {companies.length > 1 && (
          <select
            value={filterCompany}
            onChange={e => setFilterCompany(e.target.value)}
            className="text-sm text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-slate-400"
          >
            <option value="all">Tutte le aziende</option>
            {companies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

        <button
          onClick={() => setShowOnlyAbsent(v => !v)}
          className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
            showOnlyAbsent
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-white text-gray-500 border-gray-200 hover:text-gray-700'
          }`}
        >
          Solo assenti
        </button>

        <button
          onClick={() => setShowHolidayManager(true)}
          className="ml-auto flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
          Festivi
        </button>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
        <table
          style={{
            borderCollapse: 'separate',
            borderSpacing: 0,
            minWidth: NAME_COL_W + colCount * cellW,
          }}
        >
          <thead>
            <tr>
              {/* Name header */}
              <th
                className="sticky left-0 z-20 bg-white text-left px-4 text-xs font-medium text-gray-400 uppercase tracking-wide border-b border-r border-gray-100"
                style={{ minWidth: NAME_COL_W, width: NAME_COL_W, height: 52 }}
              >
                Collaboratore
              </th>

              {/* Day / month columns */}
              {periodType === 'year'
                ? yearMonths.map(month => (
                    <th
                      key={month.getMonth()}
                      className="border-b border-l border-gray-100 text-center"
                      style={{ width: cellW, minWidth: cellW, height: 52 }}
                    >
                      <div className="text-xs font-semibold text-gray-600">
                        {IT_MONTHS_SHORT[month.getMonth()]}
                      </div>
                    </th>
                  ))
                : days.map(day => {
                    const dStr = toDateStr(day)
                    const weekend = isWeekend(day)
                    const holiday = holidaySet.has(dStr)
                    const today = dStr === todayStr
                    return (
                      <th
                        key={dStr}
                        title={holiday ? holidayNames[dStr] : undefined}
                        className={`border-b border-l border-gray-100 text-center select-none align-middle ${
                          holiday ? 'bg-red-50' : weekend ? 'bg-gray-50' : 'bg-white'
                        }`}
                        style={{ width: cellW, minWidth: cellW, height: 52, padding: 0 }}
                      >
                        <div className={`text-xs font-bold leading-tight ${
                          today ? 'text-blue-600' : weekend || holiday ? 'text-gray-400' : 'text-gray-700'
                        }`}>
                          {day.getDate()}
                        </div>
                        <div className={`text-xs leading-tight ${
                          today ? 'text-blue-500' : holiday ? 'text-red-400' : 'text-gray-400'
                        }`}>
                          {IT_DAY_LETTERS[day.getDay()]}
                        </div>
                        {today && (
                          <div className="w-1 h-1 rounded-full bg-blue-500 mx-auto mt-0.5" />
                        )}
                      </th>
                    )
                  })}
            </tr>
          </thead>

          <tbody>
            {filteredProfiles.length === 0 ? (
              <tr>
                <td
                  colSpan={colCount + 1}
                  className="px-4 py-14 text-center text-sm text-gray-400"
                >
                  Nessun collaboratore trovato
                </td>
              </tr>
            ) : filteredProfiles.map((profile, pi) => {
              const isOdd = pi % 2 === 1
              const rowBg = isOdd ? '#fafafa' : '#ffffff'
              const nameBg = isOdd ? '#fafafa' : '#ffffff'
              const initials = (profile.full_name ?? profile.email)
                .split(' ')
                .map((w: string) => w[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()

              return (
                <tr key={profile.id}>
                  {/* Sticky name cell */}
                  <td
                    className="sticky left-0 z-10 border-r border-b border-gray-100 px-3 py-2"
                    style={{ minWidth: NAME_COL_W, width: NAME_COL_W, backgroundColor: nameBg }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-white text-xs font-semibold shrink-0 select-none">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate leading-tight">
                          {profile.full_name ?? profile.email}
                        </p>
                        {profile.team && (
                          <p className="text-xs text-gray-400 truncate leading-tight">{profile.team}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Day / month cells */}
                  {periodType === 'year'
                    ? yearMonths.map(month => {
                        const summary = getMonthSummary(profile.id, month)
                        return (
                          <td
                            key={month.getMonth()}
                            className="border-l border-b border-gray-100 relative p-0"
                            style={{ width: cellW, minWidth: cellW, height: 40, backgroundColor: rowBg }}
                            title={summary ? `${summary.days} gg in ${IT_MONTHS_FULL[month.getMonth()]}` : undefined}
                          >
                            {summary && (
                              <>
                                <div
                                  className="absolute inset-0"
                                  style={{ backgroundColor: summary.color, opacity: 0.15 }}
                                />
                                <div className="relative z-10 flex items-center justify-center h-full">
                                  <span className="text-xs font-bold" style={{ color: summary.color }}>
                                    {summary.days % 1 !== 0 ? summary.days.toFixed(1) : summary.days}
                                  </span>
                                </div>
                              </>
                            )}
                          </td>
                        )
                      })
                    : days.map(day => {
                        const dStr = toDateStr(day)
                        const weekend = isWeekend(day)
                        const holiday = holidaySet.has(dStr)
                        const today = dStr === todayStr
                        const absence = getAbsence(profile.id, dStr)

                        let baseBg = rowBg
                        if (holiday) baseBg = '#fef2f2'
                        else if (weekend) baseBg = isOdd ? '#f0f1f2' : '#f3f4f6'

                        return (
                          <td
                            key={dStr}
                            className="border-l border-b border-gray-100 relative p-0"
                            style={{ width: cellW, minWidth: cellW, height: 40, backgroundColor: baseBg }}
                            title={
                              absence
                                ? `${profile.full_name ?? profile.email}: ${absence.leave_types?.name ?? 'Assenza'}${absence.hours ? ` (${absence.hours}h)` : ''}`
                                : holiday
                                ? holidayNames[dStr]
                                : undefined
                            }
                          >
                            {/* Today top border */}
                            {today && (
                              <div className="absolute inset-x-0 top-0 h-0.5 bg-blue-400 z-10" />
                            )}
                            {/* Absence fill */}
                            {absence && (
                              <div
                                className="absolute left-px right-px rounded-sm"
                                style={{
                                  backgroundColor: absence.leave_types?.color ?? '#94a3b8',
                                  bottom: 2,
                                  height: absence.hours ? '48%' : 'calc(100% - 4px)',
                                  opacity: 0.85,
                                }}
                              />
                            )}
                          </td>
                        )
                      })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      {(legendItems.length > 0 || days.length > 0) && (
        <div className="flex flex-wrap items-center gap-4 mt-4 px-1">
          <span className="text-xs text-gray-400 font-medium">Legenda:</span>
          {legendItems.map(([name, color]) => (
            <span key={name} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: color, opacity: 0.85 }} />
              {name}
            </span>
          ))}
          {periodType !== 'year' && (
            <>
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb' }} />
                Weekend
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#fef2f2', border: '1px solid #fee2e2' }} />
                Festivo
              </span>
            </>
          )}
          {periodType !== 'year' && (
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span
                className="w-3 h-3 rounded-sm inline-block"
                style={{ background: 'linear-gradient(to top, #94a3b8 50%, #e2e8f0 50%)' }}
              />
              Permesso ore (metà cella)
            </span>
          )}
        </div>
      )}

      {/* Holiday manager modal */}
      {showHolidayManager && (
        <HolidayManager
          holidays={holidays}
          onClose={() => setShowHolidayManager(false)}
          onChange={setHolidays}
        />
      )}
    </div>
  )
}
