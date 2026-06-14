import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from '@/components/LogoutButton'
import NuovaRichiestaButton from '@/components/NuovaRichiestaButton'

const STATUS_LABEL: Record<string, string> = {
  pending: 'In attesa',
  approved: 'Approvata',
  rejected: 'Rifiutata',
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
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
        <div className="text-center">
          <p className="text-xl font-semibold text-gray-700">Accesso non autorizzato</p>
          <p className="text-gray-500 mt-2 text-sm">Contatta l&apos;amministratore per richiedere l&apos;accesso.</p>
          <a href={process.env.NEXT_PUBLIC_PORTAL_URL || '/'} className="mt-4 inline-block text-blue-600 hover:underline text-sm">
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

  return (
    <div className="min-h-screen bg-blue-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏖️</span>
          <h1 className="text-lg font-bold text-gray-900">Ferie e Permessi</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{profile?.full_name || user.email}</span>
          {profile?.role === 'admin' && (
            <a href="/admin" className="text-sm text-blue-600 hover:text-blue-700 font-medium">Admin</a>
          )}
          <a href={process.env.NEXT_PUBLIC_PORTAL_URL || '/'} className="text-sm text-gray-400 hover:text-gray-600">Portale</a>
          <LogoutButton />
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Le mie richieste</h2>
          <NuovaRichiestaButton leaveTypes={leaveTypes ?? []} userId={user.id} />
        </div>

        {!requests || requests.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p>Nessuna richiesta ancora.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {requests.map((req: any) => (
              <div key={req.id} className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: req.leave_types?.color || '#6B7280' }}
                    />
                    <span className="font-medium text-gray-900">{req.leave_types?.name}</span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {new Date(req.start_date).toLocaleDateString('it-IT')} — {new Date(req.end_date).toLocaleDateString('it-IT')}
                  </p>
                  {req.notes && <p className="text-xs text-gray-400 mt-1">{req.notes}</p>}
                </div>
                <span className={`text-xs font-medium px-3 py-1 rounded-full ${STATUS_COLOR[req.status]}`}>
                  {STATUS_LABEL[req.status]}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
