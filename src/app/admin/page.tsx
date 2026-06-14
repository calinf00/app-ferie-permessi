import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminRichieste, { type LeaveRequest } from '@/components/AdminRichieste'
import AdminCollaboratori, { type UserWithRequests } from '@/components/AdminCollaboratori'
import AdminPresenzeGrid, { type PresenzeProfile, type PresenzeRequest, type Holiday } from '@/components/AdminPresenzeGrid'
import { DocumentText, UsersGroup, CalendarDays, ArrowLeft } from '@/components/icons'

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const activeTab = tab === 'collaboratori' ? 'collaboratori' : tab === 'presenze' ? 'presenze' : 'richieste'

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  let adminError: string | null = null
  let requests: LeaveRequest[] = []
  let usersWithRequests: UserWithRequests[] = []
  let presenzeProfiles: PresenzeProfile[] = []
  let presenzeRequests: PresenzeRequest[] = []
  let holidays: Holiday[] = []

  try {
    const admin = createAdminClient()

    if (activeTab === 'richieste') {
      const { data, error } = await admin
        .from('leave_requests')
        .select('id, start_date, end_date, hours, status, notes, created_at, profiles!user_id(full_name, email), leave_types(name, color)')
        .order('created_at', { ascending: false })
      if (error) {
        console.error('[admin] leave_requests error:', error)
        adminError = error.message
      } else {
        requests = (data as unknown as LeaveRequest[]) ?? []
      }
    }

    if (activeTab === 'collaboratori') {
      const { data: usersData, error: usersError } = await admin
        .from('profiles')
        .select('id, full_name, role, is_active, company, team, job_title, hire_date, end_date, notes, annual_leave_days, email')
        .order('full_name', { ascending: true })
      if (usersError) {
        console.error('[admin] profiles error:', usersError)
        adminError = usersError.message
      } else if (usersData) {
        const userIds = usersData.map((u: any) => u.id)
        const { data: leaveReqs } = await admin
          .from('leave_requests')
          .select('user_id, start_date, end_date, status')
          .in('user_id', userIds)
          .eq('status', 'approved')
        usersWithRequests = usersData.map((u: any) => ({
          ...u,
          leave_requests: (leaveReqs ?? []).filter((r: any) => r.user_id === u.id),
        }))
      }
    }

    if (activeTab === 'presenze') {
      const yr = new Date().getFullYear()
      const [
        { data: profilesData, error: profilesError },
        { data: leaveData, error: leaveError },
        { data: holidaysData, error: holidaysError },
      ] = await Promise.all([
        admin
          .from('profiles')
          .select('id, full_name, email, team, company')
          .eq('is_active', true)
          .order('full_name'),
        admin
          .from('leave_requests')
          .select('id, start_date, end_date, hours, user_id, leave_types(name, color)')
          .eq('status', 'approved')
          .gte('end_date', `${yr - 1}-01-01`)
          .lte('start_date', `${yr + 2}-12-31`)
          .order('start_date'),
        admin.from('holidays').select('id, date, name').order('date'),
      ])
      if (profilesError || leaveError || holidaysError) {
        console.error('[admin] presenze error:', profilesError ?? leaveError ?? holidaysError)
        adminError = (profilesError ?? leaveError ?? holidaysError)!.message
      } else {
        presenzeProfiles = (profilesData as unknown as PresenzeProfile[]) ?? []
        presenzeRequests = (leaveData as unknown as PresenzeRequest[]) ?? []
        holidays = (holidaysData as unknown as Holiday[]) ?? []
      }
    }
  } catch (e: any) {
    console.error('[admin] createAdminClient error:', e.message)
    adminError = e.message
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-6 h-14 flex items-center gap-3 sticky top-0 z-10">
        <a
          href="/dashboard"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </a>
        <span className="text-gray-200">|</span>
        <h1 className="text-sm font-semibold text-gray-900">Area Admin</h1>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {adminError && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            Errore di configurazione: {adminError}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-8">
          <a
            href="/admin?tab=richieste"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'richieste'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <DocumentText className="w-4 h-4" />
            Comunicazioni
          </a>
          <a
            href="/admin?tab=collaboratori"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'collaboratori'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <UsersGroup className="w-4 h-4" />
            Collaboratori
          </a>
          <a
            href="/admin?tab=presenze"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'presenze'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            Presenze
          </a>
        </div>

        {activeTab === 'richieste' && (
          <AdminRichieste requests={requests} />
        )}

        {activeTab === 'collaboratori' && (
          <AdminCollaboratori users={usersWithRequests} />
        )}

        {activeTab === 'presenze' && (
          <AdminPresenzeGrid profiles={presenzeProfiles} requests={presenzeRequests} holidays={holidays} />
        )}
      </main>
    </div>
  )
}
