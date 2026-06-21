'use client'

import { useState, useMemo } from 'react'
import { Pencil, Building, UsersGroup, CalendarDays, ChartBar, ChevronDown, MagnifyingGlass, Funnel, XMark } from '@/components/icons'
import AdminEditUser, { type UserProfile } from '@/components/AdminEditUser'
import AdminGestioneAssenze, { type FullLeaveRequest } from '@/components/AdminGestioneAssenze'
import {
  calcAccruedWeekly,
  calcAnnualEntitlementWeekly,
  calcUsedDaysInCategory,
  calcAltroByType,
  fmtDays,
  type LeaveRequestForStats,
} from '@/lib/leave-utils'

export type UserWithRequests = UserProfile & {
  job_title:  string | null
  end_date:   string | null
  notes:      string | null
  leave_requests: FullLeaveRequest[]
}

function initials(name: string | null, email: string) {
  if (name) return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return email.slice(0, 2).toUpperCase()
}

function getActiveYears(requests: FullLeaveRequest[]): number[] {
  const currentYear = new Date().getFullYear()
  const yearsSet = new Set<number>([currentYear])
  for (const r of requests) {
    yearsSet.add(new Date(r.start_date).getFullYear())
    yearsSet.add(new Date(r.end_date).getFullYear())
  }
  return Array.from(yearsSet)
    .filter(y => y <= currentYear)
    .sort((a, b) => b - a)
}

function YearPanel({ year, user, requests }: {
  year: number
  user: UserProfile
  requests: LeaveRequestForStats[]
}) {
  const currentYear = new Date().getFullYear()
  const isPast = year < currentYear

  const riposiMaturati = calcAccruedWeekly(user.annual_riposi_days, user.hire_date, year)
  const riposiAnnui    = calcAnnualEntitlementWeekly(user.annual_riposi_days, user.hire_date, year)
  const riposiUsati    = calcUsedDaysInCategory('riposi', requests, year)
  const riposiDelta    = Math.max(0, Math.round((riposiMaturati - riposiUsati) * 10) / 10)

  const permssMaturati = calcAccruedWeekly(user.annual_permessi_days, user.hire_date, year)
  const permssAnnui    = calcAnnualEntitlementWeekly(user.annual_permessi_days, user.hire_date, year)
  const permssUsati    = calcUsedDaysInCategory('permessi', requests, year)
  const permssDelta    = Math.max(0, Math.round((permssMaturati - permssUsati) * 10) / 10)

  const altro = calcAltroByType(requests, year)

  const statCell = (label: string, value: number, highlight?: boolean) => (
    <div className="text-center">
      <p className={`text-sm font-semibold ${highlight ? 'text-slate-700' : 'text-gray-700'}`}>
        {fmtDays(value)}
      </p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  )

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-600">{year}</span>
        {year === currentYear && (
          <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-medium">Anno corrente</span>
        )}
      </div>

      <div className="px-4 py-3 flex flex-col gap-3">
        {/* Riposi */}
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Riposi <span className="font-normal normal-case">({user.annual_riposi_days} gg/anno)</span>
          </p>
          <div className="grid grid-cols-4 gap-2 bg-slate-50 rounded-lg px-3 py-2.5">
            {statCell('Maturati', riposiMaturati)}
            {statCell('Tot. anno', riposiAnnui)}
            {statCell('Usati', riposiUsati)}
            {isPast
              ? statCell('Scaduti', riposiDelta)
              : statCell('Rimanenti', riposiDelta, true)}
          </div>
        </div>

        {/* Permessi */}
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Permessi <span className="font-normal normal-case">({user.annual_permessi_days} gg/anno)</span>
          </p>
          <div className="grid grid-cols-4 gap-2 bg-blue-50 rounded-lg px-3 py-2.5">
            {statCell('Maturati', permssMaturati)}
            {statCell('Tot. anno', permssAnnui)}
            {statCell('Usati', permssUsati)}
            {isPast
              ? statCell('Scaduti', permssDelta)
              : statCell('Rimanenti', permssDelta, true)}
          </div>
        </div>

        {/* Altro */}
        {altro.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Altro</p>
            <div className="flex flex-wrap gap-2">
              {altro.map(a => (
                <span
                  key={a.name}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-100 text-gray-600"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                  {a.name}: <span className="font-semibold">{fmtDays(a.days)} gg</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

type SortKey = 'az' | 'za' | 'recent' | 'oldest'

export default function AdminCollaboratori({ users }: { users: UserWithRequests[] }) {
  const [editing, setEditing] = useState<UserProfile | null>(null)
  const [managingAssenze, setManagingAssenze] = useState<UserWithRequests | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [allExpanded, setAllExpanded] = useState(false)

  // Ricerca e filtri
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('az')
  const [teamFilter, setTeamFilter] = useState('all')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'collaboratore'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [hiredThisYearOnly, setHiredThisYearOnly] = useState(false)

  const currentYear = new Date().getFullYear()

  const teams = useMemo(
    () => Array.from(new Set(users.map(u => u.team).filter((t): t is string => !!t))).sort((a, b) => a.localeCompare(b, 'it')),
    [users]
  )
  const companies = useMemo(
    () => Array.from(new Set(users.map(u => u.company).filter((c): c is string => !!c))).sort((a, b) => a.localeCompare(b, 'it')),
    [users]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const nameOf = (u: UserWithRequests) => (u.full_name ?? u.email).toLowerCase()
    const hireTime = (u: UserWithRequests) => (u.hire_date ? new Date(u.hire_date).getTime() : null)

    const list = users.filter(u => {
      if (q) {
        const hay = [u.full_name, u.email, u.job_title, u.team, u.company]
          .filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (teamFilter !== 'all' && u.team !== teamFilter) return false
      if (companyFilter !== 'all' && u.company !== companyFilter) return false
      if (roleFilter === 'admin' && u.role !== 'admin') return false
      if (roleFilter === 'collaboratore' && u.role === 'admin') return false
      if (statusFilter === 'active' && !u.is_active) return false
      if (statusFilter === 'inactive' && u.is_active) return false
      if (hiredThisYearOnly && !(u.hire_date && new Date(u.hire_date).getFullYear() === currentYear)) return false
      return true
    })

    return list.sort((a, b) => {
      if (sort === 'recent' || sort === 'oldest') {
        const ta = hireTime(a), tb = hireTime(b)
        if (ta === null && tb === null) return nameOf(a).localeCompare(nameOf(b), 'it')
        if (ta === null) return 1
        if (tb === null) return -1
        return sort === 'recent' ? tb - ta : ta - tb
      }
      const cmp = nameOf(a).localeCompare(nameOf(b), 'it')
      return sort === 'za' ? -cmp : cmp
    })
  }, [users, search, sort, teamFilter, companyFilter, roleFilter, statusFilter, hiredThisYearOnly, currentYear])

  const anyFilterActive =
    search.trim() !== '' || teamFilter !== 'all' || companyFilter !== 'all' ||
    roleFilter !== 'all' || statusFilter !== 'all' || hiredThisYearOnly

  function resetFilters() {
    setSearch(''); setSort('az'); setTeamFilter('all'); setCompanyFilter('all')
    setRoleFilter('all'); setStatusFilter('all'); setHiredThisYearOnly(false)
  }

  function toggleUser(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (allExpanded) {
      setExpandedIds(new Set())
      setAllExpanded(false)
    } else {
      setExpandedIds(new Set(filtered.map(u => u.id)))
      setAllExpanded(true)
    }
  }

  const selectCls = 'text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300'

  return (
    <>
      {editing && <AdminEditUser user={editing} onClose={() => setEditing(null)} />}
      {managingAssenze && (
        <AdminGestioneAssenze
          user={managingAssenze}
          initialRequests={managingAssenze.leave_requests}
          onClose={() => setManagingAssenze(null)}
        />
      )}

      <div className="flex flex-col gap-3">
        {/* Ricerca e filtri */}
        {users.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-3 sm:p-4 flex flex-col gap-3">
            <div className="relative">
              <MagnifyingGlass className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cerca per nome, email, ruolo, team o azienda…"
                className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                  title="Pulisci ricerca"
                >
                  <XMark className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Funnel className="w-3.5 h-3.5" /> Filtri:
              </span>

              <select value={sort} onChange={e => setSort(e.target.value as SortKey)} className={selectCls}>
                <option value="az">Nome A → Z</option>
                <option value="za">Nome Z → A</option>
                <option value="recent">Assunzione recente</option>
                <option value="oldest">Assunzione meno recente</option>
              </select>

              {teams.length > 0 && (
                <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} className={selectCls}>
                  <option value="all">Tutti i team</option>
                  {teams.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              )}

              {companies.length > 0 && (
                <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} className={selectCls}>
                  <option value="all">Tutte le aziende</option>
                  {companies.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}

              <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as typeof roleFilter)} className={selectCls}>
                <option value="all">Tutti i ruoli</option>
                <option value="admin">Admin</option>
                <option value="collaboratore">Collaboratori</option>
              </select>

              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} className={selectCls}>
                <option value="all">Attivi e inattivi</option>
                <option value="active">Solo attivi</option>
                <option value="inactive">Solo inattivi</option>
              </select>

              <button
                onClick={() => setHiredThisYearOnly(v => !v)}
                className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
                  hiredThisYearOnly
                    ? 'border-slate-300 bg-slate-100 text-slate-700'
                    : 'border-gray-200 text-gray-600 hover:bg-slate-50'
                }`}
              >
                Assunti nel {currentYear}
              </button>

              {anyFilterActive && (
                <button onClick={resetFilters} className="text-xs font-medium px-2.5 py-1.5 rounded-lg text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <XMark className="w-3.5 h-3.5" /> Azzera
                </button>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {filtered.length} di {users.length} collaborator{users.length === 1 ? 'e' : 'i'}
              </span>
              {filtered.length > 0 && (
                <button
                  onClick={toggleAll}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-slate-50 hover:text-slate-700 transition-colors flex items-center gap-1"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${allExpanded ? 'rotate-180' : ''}`} />
                  {allExpanded ? 'Comprimi tutti' : 'Espandi tutti'}
                </button>
              )}
            </div>
          </div>
        )}

        {filtered.map(u => {
          const isExpanded = expandedIds.has(u.id)
          const years = getActiveYears(u.leave_requests)
          const statsRequests = u.leave_requests as LeaveRequestForStats[]

          return (
            <div key={u.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {/* Card header */}
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-sm font-semibold shrink-0 select-none">
                    {initials(u.full_name, u.email)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 leading-tight break-words">{u.full_name ?? u.email}</p>
                        {u.full_name && <p className="text-xs text-gray-400 mt-0.5 break-words">{u.email}</p>}
                      </div>
                      <div className="flex items-center flex-wrap gap-2 shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === 'admin' ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-700'}`}>
                          {u.role === 'admin' ? 'Admin' : 'Collaboratore'}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                          {u.is_active ? 'Attivo' : 'Inattivo'}
                        </span>
                        <button
                          onClick={() => setManagingAssenze(u)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                          title="Gestisci assenze"
                        >
                          <CalendarDays className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditing(u)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                          title="Modifica profilo"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                      {u.company && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Building className="w-3.5 h-3.5" /> {u.company}
                        </span>
                      )}
                      {u.team && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <UsersGroup className="w-3.5 h-3.5" /> {u.team}
                        </span>
                      )}
                      {u.hire_date && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <CalendarDays className="w-3.5 h-3.5" />
                          Dal {new Date(u.hire_date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick summary for current year */}
                {(() => {
                  const cy = new Date().getFullYear()
                  const riposiR = Math.max(0, Math.round((calcAnnualEntitlementWeekly(u.annual_riposi_days, u.hire_date, cy) - calcUsedDaysInCategory('riposi', statsRequests, cy)) * 10) / 10)
                  const permssR = Math.max(0, Math.round((calcAnnualEntitlementWeekly(u.annual_permessi_days, u.hire_date, cy) - calcUsedDaysInCategory('permessi', statsRequests, cy)) * 10) / 10)
                  return (
                    <div className="mt-3 flex gap-3">
                      <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2 flex items-center justify-between">
                        <span className="text-xs text-gray-500">Riposi rimanenti {cy}</span>
                        <span className="text-sm font-bold text-slate-700">{fmtDays(riposiR)} <span className="text-xs font-normal text-gray-400">gg</span></span>
                      </div>
                      <div className="flex-1 bg-blue-50 rounded-xl px-3 py-2 flex items-center justify-between">
                        <span className="text-xs text-gray-500">Permessi rimanenti {cy}</span>
                        <span className="text-sm font-bold text-blue-700">{fmtDays(permssR)} <span className="text-xs font-normal text-gray-400">gg</span></span>
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Expand toggle */}
              <button
                onClick={() => toggleUser(u.id)}
                className="w-full flex items-center justify-between px-5 py-2.5 border-t border-gray-100 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <ChartBar className="w-3.5 h-3.5" />
                  {isExpanded ? 'Nascondi storico bilancio' : 'Mostra storico bilancio'}
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>

              {/* Expanded: year-by-year panels */}
              {isExpanded && (
                <div className="px-5 pb-5 pt-3 flex flex-col gap-3">
                  {years.map(year => (
                    <YearPanel
                      key={year}
                      year={year}
                      user={u}
                      requests={statsRequests}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {users.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            Nessun collaboratore registrato
          </div>
        )}

        {users.length > 0 && filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm flex flex-col items-center gap-3">
            Nessun collaboratore corrisponde ai filtri
            <button
              onClick={resetFilters}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-slate-50 hover:text-slate-700"
            >
              Azzera filtri
            </button>
          </div>
        )}
      </div>
    </>
  )
}
