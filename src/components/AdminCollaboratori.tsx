'use client'

import { useState, useMemo } from 'react'
import { Pencil, Building, UsersGroup, CalendarDays, ChartBar, ChevronDown } from '@/components/icons'
import AdminEditUser, { type UserProfile } from '@/components/AdminEditUser'
import AdminGestioneAssenze, { type FullLeaveRequest } from '@/components/AdminGestioneAssenze'
import {
  categorizeLeaveType,
  calcAccruedMonthly,
  calcAnnualEntitlement,
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

  const riposiMaturati = calcAccruedMonthly(user.annual_riposi_days, user.hire_date, year)
  const riposiUsati    = calcUsedDaysInCategory('riposi', requests, year)
  const riposiDelta    = Math.max(0, Math.round((riposiMaturati - riposiUsati) * 10) / 10)

  const permssMaturati = calcAccruedMonthly(user.annual_permessi_days, user.hire_date, year)
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

export default function AdminCollaboratori({ users }: { users: UserWithRequests[] }) {
  const [editing, setEditing] = useState<UserProfile | null>(null)
  const [managingAssenze, setManagingAssenze] = useState<UserWithRequests | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [allExpanded, setAllExpanded] = useState(false)

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
      setExpandedIds(new Set(users.map(u => u.id)))
      setAllExpanded(true)
    }
  }

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
        {users.length > 0 && (
          <div className="flex justify-end">
            <button
              onClick={toggleAll}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-slate-50 hover:text-slate-700 transition-colors flex items-center gap-1"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${allExpanded ? 'rotate-180' : ''}`} />
              {allExpanded ? 'Comprimi tutti' : 'Espandi tutti'}
            </button>
          </div>
        )}

        {users.map(u => {
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
                  const riposiR = Math.max(0, Math.round((calcAnnualEntitlement(u.annual_riposi_days, u.hire_date, cy) - calcUsedDaysInCategory('riposi', statsRequests, cy)) * 10) / 10)
                  const permssR = Math.max(0, Math.round((calcAnnualEntitlement(u.annual_permessi_days, u.hire_date, cy) - calcUsedDaysInCategory('permessi', statsRequests, cy)) * 10) / 10)
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
      </div>
    </>
  )
}
