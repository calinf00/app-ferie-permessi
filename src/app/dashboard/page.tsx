import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import LogoutButton from '@/components/LogoutButton'
import NuovaRichiestaButton from '@/components/NuovaRichiestaButton'
import TeamView, { type TeamRequest } from '@/components/TeamView'
import { SunHorizon, Building, UsersGroup, CalendarDays, ChartBar, DocumentText, ArrowLeft } from '@/components/icons'
import CancelRequestButton from '@/components/CancelRequestButton'
import { calcLeaveStats, formatDate, daysDiff } from '@/lib/leave-utils'

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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const activeTab = tab === 'team' ? 'team' : 'richieste'

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, company, team, hire_date, annual_leave_days')
    .eq('id', user.id)
    .single()

  const { data: permission } = await supabase
    .from('user_app_permissions')
    .select('app_id, apps!inner(slug)')
    .eq('user_id', user.id)
    .eq('apps.slug', 'ferie-permessi')
    .maybeSingle()

  if (!permission && profile?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-sm px-6">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <SunHorizon className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-lg font-semibold text-gray-800">Accesso non autorizzato</p>
          <p className="text-gray-500 mt-2 text-sm">Contatta l&apos;amministratore per richiedere l&apos;accesso a questa app.</p>
          <a
            href={process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://work-apps-portal.vercel.app'}
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Torna al portale
          </a>
        </div>
      </div>
    )
  }

  const [{ data: requests }, { data: leaveTypes }] = await Promise.all([
    supabase
      .from('leave_requests')
      .select('id, start_date, end_date, hours, status, notes, leave_types(name, color)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('leave_types').select('id, name, color'),
  ])

  const approvedRequests = (requests ?? [])
    .filter((r: any) => r.status === 'approved')
    .map((r: any) => ({ start_date: r.start_date, end_date: r.end_date }))

  const leaveStats = calcLeaveStats(
    profile?.hire_date ?? null,
    profile?.annual_leave_days ?? 20,
    approvedRequests
  )

  // Giorni totali comunicati (non rifiutati, solo giornate intere) per la vista utente
  const communicatedDays = (requests ?? [])
    .filter((r: any) => r.status !== 'rejected')
    .reduce((sum: number, r: any) => {
      if (r.hours) return sum
      return sum + daysDiff(r.start_date, r.end_date)
    }, 0)
  const totalDays = profile?.annual_leave_days ?? 20

  let teamRequests: TeamRequest[] = []
  if (activeTab === 'team' && profile?.team) {
    const today = new Date().toISOString().split('T')[0]
    const admin = createAdminClient()
    const { data: teamData } = await admin
      .from('leave_requests')
      .select('id, start_date, end_date, status, user_id, profiles!user_id(full_name, email, team), leave_types(name, color)')
      .eq('status', 'approved')
      .gte('end_date', today)
      .neq('user_id', user.id)
      .order('start_date', { ascending: true })
    teamRequests = ((teamData as unknown as TeamRequest[]) ?? []).filter(r => r.profiles?.team === profile.team)
  }

  const isAdmin = profile?.role === 'admin'
  const firstName = profile?.full_name?.split(' ')[0]
  const initials = (profile?.full_name ?? user.email ?? '').slice(0, 2).toUpperCase()

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center">
            <SunHorizon className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-gray-900 text-sm">Comunicazioni Assenze</span>
        </div>
        <div className="flex items-center gap-2">
          {profile?.role === 'admin' && (
            <a href="/admin" className="text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors">
              Admin
            </a>
          )}
          <a
            href={process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://work-apps-portal.vercel.app'}
            className="text-xs text-gray-500 hover:text-gray-700 font-medium px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Portale
          </a>
          <div className="w-7 h-7 bg-gradient-to-br from-slate-600 to-slate-800 rounded-full flex items-center justify-center text-white text-xs font-semibold select-none">
            {initials}
          </div>
          <LogoutButton />
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Greeting */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            {firstName ? `Ciao, ${firstName}` : 'La mia area'}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Storico delle tue comunicazioni di assenza</p>
        </div>

        {/* Profile + leave stats card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 bg-gradient-to-br from-slate-600 to-slate-800 rounded-full flex items-center justify-center text-white font-semibold select-none">
              {initials}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{profile?.full_name ?? user.email}</p>
              {profile?.full_name && <p className="text-xs text-gray-400">{user.email}</p>}
            </div>
          </div>

          {/* Detail chips */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4">
            {profile?.company && (
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <Building className="w-3.5 h-3.5 text-gray-400" /> {profile.company}
              </span>
            )}
            {profile?.team && (
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <UsersGroup className="w-3.5 h-3.5 text-gray-400" /> {profile.team}
              </span>
            )}
            {profile?.hire_date && (
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
                Dal {formatDate(profile.hire_date)}
              </span>
            )}
          </div>

          {/* Stats utente: totale / utilizzati / rimanenti */}
          {!isAdmin && (
            <div className="bg-gray-50 rounded-xl px-4 py-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">{totalDays}</p>
                  <p className="text-xs text-gray-400">Totale anno</p>
                </div>
                <div className="text-center border-x border-gray-200">
                  <p className="text-lg font-bold text-gray-900">{leaveStats.usedDays}</p>
                  <p className="text-xs text-gray-400">Utilizzati</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-700">{Math.max(0, totalDays - leaveStats.usedDays)}</p>
                  <p className="text-xs text-gray-400">Rimanenti</p>
                </div>
              </div>
            </div>
          )}

          {/* Leave stats — solo admin */}
          {isAdmin && (
            <div className="bg-gray-50 rounded-xl px-4 py-4">
              <div className="flex items-center justify-between mb-3">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  <ChartBar className="w-3.5 h-3.5" />
                  Giorni di riposo {new Date().getFullYear()}
                </span>
                <span className="text-xs text-gray-400">
                  {leaveStats.annualDays} gg/anno
                </span>
              </div>

              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-slate-700 rounded-full transition-all duration-700"
                    style={{ width: leaveStats.annualDays > 0 ? `${Math.min(100, Math.round((leaveStats.accrued / leaveStats.annualDays) * 100))}%` : '0%' }}
                  />
                </div>
                <span className="text-sm font-bold text-gray-900 whitespace-nowrap">
                  {leaveStats.remaining} <span className="text-xs font-normal text-gray-400">rimanenti</span>
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">{leaveStats.accrued}</p>
                  <p className="text-xs text-gray-400">Maturati</p>
                </div>
                <div className="text-center border-x border-gray-200">
                  <p className="text-lg font-bold text-gray-900">{leaveStats.usedDays}</p>
                  <p className="text-xs text-gray-400">Usati</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-700">{leaveStats.remaining}</p>
                  <p className="text-xs text-gray-400">Rimanenti</p>
                </div>
              </div>

              <p className="text-xs text-center text-gray-400 mt-3">
                Maturazione: {leaveStats.monthlyRate} gg/mese · {leaveStats.weeklyRate} gg/settimana
              </p>
            </div>
          )}
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
          <a
            href="/dashboard"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'richieste'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <DocumentText className="w-4 h-4" />
            Le mie comunicazioni
          </a>
          <a
            href="/dashboard?tab=team"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'team'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <UsersGroup className="w-4 h-4" />
            Il mio team
          </a>
        </div>

        {activeTab === 'team' ? (
          profile?.team ? (
            <TeamView requests={teamRequests} userTeam={profile.team} />
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <UsersGroup className="w-7 h-7 text-gray-400" />
              </div>
              <p className="text-gray-700 font-medium">Nessun team assegnato</p>
              <p className="text-sm text-gray-400 mt-1">Contatta l&apos;amministratore per essere assegnato a un team</p>
            </div>
          )
        ) : (
          <>
        {/* Requests header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 text-sm">Le mie comunicazioni</h3>
          <NuovaRichiestaButton leaveTypes={leaveTypes ?? []} userId={user.id} />
        </div>

        {!requests || requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <DocumentText className="w-7 h-7 text-gray-400" />
            </div>
            <p className="text-gray-700 font-medium">Nessuna comunicazione ancora</p>
            <p className="text-sm text-gray-400 mt-1">Clicca su &quot;Nuova comunicazione&quot; per iniziare</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {requests.map((req: any) => {
              const days = daysDiff(req.start_date, req.end_date)
              const durationLabel = req.hours
                ? `${req.hours} ${req.hours === 1 ? 'ora' : 'ore'}`
                : `${days} ${days === 1 ? 'giorno' : 'giorni'}`
              return (
                <div key={req.id} className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center justify-between hover:border-gray-200 transition-colors">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-1 h-12 rounded-full shrink-0"
                      style={{ backgroundColor: req.leave_types?.color || '#CBD5E1' }}
                    />
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-gray-900 text-sm">{req.leave_types?.name}</span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-400">{durationLabel}</span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {formatDate(req.start_date)}
                        {!req.hours && req.start_date !== req.end_date && <> — {formatDate(req.end_date)}</>}
                      </p>
                      {req.notes && <p className="text-xs text-gray-400 mt-1 truncate max-w-xs">{req.notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-medium px-3 py-1.5 rounded-lg ${STATUS_STYLE[req.status]}`}>
                      {STATUS_LABEL[req.status]}
                    </span>
                    {(req.status === 'pending' || req.status === 'approved') && (
                      <CancelRequestButton requestId={req.id} userId={user.id} status={req.status} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
          </>
        )}
      </main>
    </div>
  )
}
