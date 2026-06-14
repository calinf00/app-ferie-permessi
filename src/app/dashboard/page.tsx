import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from '@/components/LogoutButton'
import NuovaRichiestaButton from '@/components/NuovaRichiestaButton'

const STATUS_LABEL: Record<string, string> = {
  pending: 'In attesa',
  approved: 'Approvata',
  rejected: 'Rifiutata',
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border border-amber-100',
  approved: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  rejected: 'bg-red-50 text-red-600 border border-red-100',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysDiff(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  return Math.round(ms / 86400000) + 1
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
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
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <div className="text-center max-w-sm px-6">
          <div className="text-4xl mb-4">🔒</div>
          <p className="text-lg font-semibold text-gray-800">Accesso non autorizzato</p>
          <p className="text-gray-500 mt-2 text-sm">Contatta l&apos;amministratore per richiedere l&apos;accesso a questa app.</p>
          <a
            href={process.env.NEXT_PUBLIC_PORTAL_URL || '/'}
            className="mt-6 inline-block text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            ← Torna al portale
          </a>
        </div>
      </div>
    )
  }

  const [{ data: requests }, { data: leaveTypes }] = await Promise.all([
    supabase
      .from('leave_requests')
      .select('id, start_date, end_date, status, notes, leave_types(name, color)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('leave_types').select('id, name, color'),
  ])

  const firstName = profile?.full_name?.split(' ')[0]

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🏖️</span>
          <span className="font-semibold text-gray-900 text-sm">Ferie e Permessi</span>
        </div>
        <div className="flex items-center gap-2">
          {profile?.role === 'admin' && (
            <a href="/admin" className="text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
              Admin
            </a>
          )}
          <a
            href={process.env.NEXT_PUBLIC_PORTAL_URL || '/'}
            className="text-xs text-gray-400 hover:text-gray-600 font-medium px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Portale
          </a>
          <LogoutButton />
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {firstName ? `Ciao, ${firstName} 👋` : 'Le mie richieste'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">Storico delle tue richieste di assenza</p>
          </div>
          <NuovaRichiestaButton leaveTypes={leaveTypes ?? []} userId={user.id} />
        </div>

        {!requests || requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl mb-4">📋</div>
            <p className="text-gray-700 font-medium">Nessuna richiesta ancora</p>
            <p className="text-sm text-gray-400 mt-1">Clicca su &quot;+ Nuova richiesta&quot; per iniziare</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {requests.map((req: any) => {
              const days = daysDiff(req.start_date, req.end_date)
              return (
                <div key={req.id} className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center justify-between group hover:border-gray-200 transition-colors">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-1 h-12 rounded-full shrink-0"
                      style={{ backgroundColor: req.leave_types?.color || '#CBD5E1' }}
                    />
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-gray-900 text-sm">{req.leave_types?.name}</span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-400">{days} {days === 1 ? 'giorno' : 'giorni'}</span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {formatDate(req.start_date)}
                        {req.start_date !== req.end_date && <> — {formatDate(req.end_date)}</>}
                      </p>
                      {req.notes && <p className="text-xs text-gray-400 mt-1 truncate max-w-xs">{req.notes}</p>}
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-3 py-1.5 rounded-lg shrink-0 ${STATUS_STYLE[req.status]}`}>
                    {STATUS_LABEL[req.status]}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
