import { UsersGroup, CalendarDays } from '@/components/icons'
import { formatDate, daysDiff } from '@/lib/leave-utils'

export type TeamRequest = {
  id: string
  start_date: string
  end_date: string
  user_id: string
  profiles: { full_name: string | null; email: string; team: string | null } | null
  leave_types: { name: string; color: string } | null
}

function initials(name: string | null, email: string) {
  if (name) return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return email.slice(0, 2).toUpperCase()
}

function TeamCard({ req, onLeaveNow }: { req: TeamRequest; onLeaveNow: boolean }) {
  const name = req.profiles?.full_name ?? req.profiles?.email ?? '—'
  const email = req.profiles?.email ?? ''
  const days = daysDiff(req.start_date, req.end_date)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center justify-between hover:border-gray-200 transition-colors">
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-sm font-semibold shrink-0 select-none">
          {initials(req.profiles?.full_name ?? null, email)}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{name}</p>
          <div className="flex items-center gap-2 mt-1">
            {req.leave_types && (
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: req.leave_types.color || '#CBD5E1' }}
                />
                {req.leave_types.name}
              </span>
            )}
          </div>
          <p className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
            <CalendarDays className="w-3.5 h-3.5" />
            {formatDate(req.start_date)}
            {req.start_date !== req.end_date && <> — {formatDate(req.end_date)}</>}
            <span className="text-gray-300">·</span>
            {days} {days === 1 ? 'giorno' : 'giorni'}
          </p>
        </div>
      </div>
      {onLeaveNow && (
        <span className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0">
          In riposo ora
        </span>
      )}
    </div>
  )
}

export default function TeamView({ requests, userTeam }: { requests: TeamRequest[]; userTeam: string }) {
  const todayStr = new Date().toISOString().split('T')[0]

  const teamRequests = requests.filter(r => r.profiles?.team === userTeam)

  const onLeaveNow = teamRequests.filter(r => todayStr >= r.start_date && todayStr <= r.end_date)
  const upcoming = teamRequests.filter(r => r.start_date > todayStr)

  if (onLeaveNow.length === 0 && upcoming.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
          <UsersGroup className="w-7 h-7 text-gray-400" />
        </div>
        <p className="text-gray-700 font-medium">Nessuna assenza pianificata nel team</p>
        <p className="text-sm text-gray-400 mt-1">I tuoi colleghi del team {userTeam} sono tutti presenti</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {onLeaveNow.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">In riposo ora</h4>
          <div className="flex flex-col gap-3">
            {onLeaveNow.map(req => (
              <TeamCard key={req.id} req={req} onLeaveNow />
            ))}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Prossime assenze</h4>
          <div className="flex flex-col gap-3">
            {upcoming.map(req => (
              <TeamCard key={req.id} req={req} onLeaveNow={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
