'use client'

import { useState } from 'react'
import { Pencil, Building, UsersGroup, CalendarDays, ChartBar } from '@/components/icons'
import AdminEditUser, { type UserProfile } from '@/components/AdminEditUser'
import AdminGestioneAssenze, { type FullLeaveRequest } from '@/components/AdminGestioneAssenze'
import { calcLeaveStats } from '@/lib/leave-utils'

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

export default function AdminCollaboratori({ users }: { users: UserWithRequests[] }) {
  const [editing, setEditing] = useState<UserProfile | null>(null)
  const [managingAssenze, setManagingAssenze] = useState<UserWithRequests | null>(null)

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
        {users.map(u => {
          const approvedRequests = u.leave_requests.filter(r => r.status === 'approved')
          const stats = calcLeaveStats(u.hire_date, u.annual_leave_days, approvedRequests)
          const pct = stats.annualDays > 0 ? Math.round((stats.accrued / stats.annualDays) * 100) : 0

          return (
            <div key={u.id} className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-sm font-semibold shrink-0 select-none">
                  {initials(u.full_name, u.email)}
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900 leading-tight">{u.full_name ?? u.email}</p>
                      {u.full_name && <p className="text-xs text-gray-400 mt-0.5">{u.email}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
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

                  {/* Details row */}
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

                  {/* Leave stats */}
                  <div className="mt-3 bg-gray-50 rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                        <ChartBar className="w-3.5 h-3.5" /> Giorni di riposo {new Date().getFullYear()}
                      </span>
                      <span className="text-xs text-gray-400">
                        {stats.annualDays} gg/anno · {stats.monthlyRate} gg/mese
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full bg-slate-700 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">
                        {stats.remaining} <span className="font-normal text-gray-400">rimanenti</span>
                      </span>
                    </div>
                    <div className="flex gap-4 mt-2">
                      <span className="text-xs text-gray-400">Maturati: <span className="font-medium text-gray-600">{stats.accrued}</span></span>
                      <span className="text-xs text-gray-400">Usati: <span className="font-medium text-gray-600">{stats.usedDays}</span></span>
                    </div>
                  </div>
                </div>
              </div>
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
