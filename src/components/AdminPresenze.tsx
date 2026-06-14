'use client'

import { useMemo, useState } from 'react'
import { Building, UsersGroup, CalendarDays } from '@/components/icons'
import { formatDate, daysDiff } from '@/lib/leave-utils'

export type Profile = {
  id: string
  full_name: string | null
  email: string
  team: string | null
  company: string | null
}

export type LeaveEntry = {
  id: string
  start_date: string
  end_date: string
  user_id: string
  profiles: { full_name: string | null; email: string; team: string | null; company: string | null } | null
  leave_types: { name: string; color: string } | null
}

const PERIODS: { key: string; label: string }[] = [
  { key: 'week', label: 'Questa settimana' },
  { key: 'month', label: 'Questo mese' },
  { key: 'next_month', label: 'Prossimo mese' },
  { key: 'next_2weeks', label: 'Prossime 2 settimane' },
]

function getPeriodRange(period: string): { start: Date; end: Date } {
  const now = new Date()
  if (period === 'week') {
    const day = now.getDay() || 7
    const mon = new Date(now); mon.setDate(now.getDate() - day + 1); mon.setHours(0, 0, 0, 0)
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23, 59, 59, 999)
    return { start: mon, end: sun }
  }
  if (period === 'month') {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0) }
  }
  if (period === 'next_month') {
    return { start: new Date(now.getFullYear(), now.getMonth() + 1, 1), end: new Date(now.getFullYear(), now.getMonth() + 2, 0) }
  }
  // next_2weeks
  const start = new Date(now); start.setHours(0, 0, 0, 0)
  const end = new Date(now); end.setDate(now.getDate() + 13); end.setHours(23, 59, 59, 999)
  return { start, end }
}

function initials(name: string | null, email: string) {
  if (name) return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return email.slice(0, 2).toUpperCase()
}

export default function AdminPresenze({ profiles, requests }: { profiles: Profile[]; requests: LeaveEntry[] }) {
  const [period, setPeriod] = useState('week')
  const [filterTeam, setFilterTeam] = useState('all')
  const [filterCompany, setFilterCompany] = useState('all')
  const [showOnlyOnLeave, setShowOnlyOnLeave] = useState(false)

  const teams = useMemo(
    () => Array.from(new Set(profiles.map(p => p.team).filter((t): t is string => !!t))).sort(),
    [profiles]
  )
  const companies = useMemo(
    () => Array.from(new Set(profiles.map(p => p.company).filter((c): c is string => !!c))).sort(),
    [profiles]
  )

  const rows = useMemo(() => {
    const { start, end } = getPeriodRange(period)

    const mapped = profiles.map(profile => {
      const profileLeave = requests.filter(r =>
        r.user_id === profile.id &&
        new Date(r.start_date) <= end &&
        new Date(r.end_date) >= start
      )
      return { profile, leave: profileLeave, onLeave: profileLeave.length > 0 }
    })

    const filtered = mapped.filter(({ profile, onLeave }) => {
      if (filterTeam !== 'all' && profile.team !== filterTeam) return false
      if (filterCompany !== 'all' && profile.company !== filterCompany) return false
      if (showOnlyOnLeave && !onLeave) return false
      return true
    })

    filtered.sort((a, b) => {
      if (a.onLeave !== b.onLeave) return a.onLeave ? -1 : 1
      const an = (a.profile.full_name ?? a.profile.email).toLowerCase()
      const bn = (b.profile.full_name ?? b.profile.email).toLowerCase()
      return an.localeCompare(bn)
    })

    return filtered
  }, [profiles, requests, period, filterTeam, filterCompany, showOnlyOnLeave])

  const onLeaveCount = rows.filter(r => r.onLeave).length

  return (
    <div>
      {/* Period pills */}
      <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-4">
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === p.key ? 'bg-slate-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={filterTeam}
          onChange={e => setFilterTeam(e.target.value)}
          className="text-sm text-gray-900 bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-slate-400"
        >
          <option value="all">Tutti i team</option>
          {teams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={filterCompany}
          onChange={e => setFilterCompany(e.target.value)}
          className="text-sm text-gray-900 bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-slate-400"
        >
          <option value="all">Tutte le aziende</option>
          {companies.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <button
          onClick={() => setShowOnlyOnLeave(v => !v)}
          className={`text-sm font-medium px-3 py-2 rounded-lg border transition-colors ${
            showOnlyOnLeave
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-white text-gray-500 border-gray-200 hover:text-gray-700'
          }`}
        >
          Solo chi è in riposo
        </button>
      </div>

      {/* Count line */}
      <p className="text-sm text-gray-500 mb-4">
        <span className="font-semibold text-gray-900">{onLeaveCount}</span> {onLeaveCount === 1 ? 'collaboratore' : 'collaboratori'} in riposo nel periodo
      </p>

      {/* List */}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
            <UsersGroup className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-gray-700 font-medium">Nessun collaboratore</p>
          <p className="text-sm text-gray-400 mt-1">Prova a cambiare i filtri o il periodo</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map(({ profile, leave, onLeave }) => (
            <div key={profile.id} className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-sm font-semibold shrink-0 select-none">
                    {initials(profile.full_name, profile.email)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 leading-tight truncate">{profile.full_name ?? profile.email}</p>
                    {profile.full_name && <p className="text-xs text-gray-400 mt-0.5 truncate">{profile.email}</p>}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {profile.team && (
                        <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">
                          <UsersGroup className="w-3 h-3" /> {profile.team}
                        </span>
                      )}
                      {profile.company && (
                        <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">
                          <Building className="w-3 h-3" /> {profile.company}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Leave entries */}
                <div className="shrink-0 text-right">
                  {onLeave ? (
                    <div className="flex flex-col gap-2 items-end">
                      {leave.map(entry => {
                        const days = daysDiff(entry.start_date, entry.end_date)
                        return (
                          <div key={entry.id} className="flex items-center gap-2 text-xs text-gray-600">
                            {entry.leave_types && (
                              <span className="flex items-center gap-1.5">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: entry.leave_types.color || '#CBD5E1' }}
                                />
                                {entry.leave_types.name}
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-gray-400">
                              <CalendarDays className="w-3.5 h-3.5" />
                              {formatDate(entry.start_date)}
                              {entry.start_date !== entry.end_date && <> — {formatDate(entry.end_date)}</>}
                              <span className="text-gray-300">·</span>
                              {days} {days === 1 ? 'gg' : 'gg'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Nessuna assenza</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
