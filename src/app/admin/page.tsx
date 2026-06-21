import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminRichieste, { type LeaveRequest } from '@/components/AdminRichieste'
import AdminCollaboratori, { type UserWithRequests } from '@/components/AdminCollaboratori'
import AdminPresenzeGrid, { type PresenzeProfile, type PresenzeRequest, type Holiday } from '@/components/AdminPresenzeGrid'
import AdminBulkAssignButton from '@/components/AdminBulkAssignButton'
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
      const [{ data, error }, { data: ltData }] = await Promise.all([
        admin
          .from('leave_requests')
          .select('id, start_date, end_date, hours, time_ranges, status, notes, admin_modified, admin_notes, created_at, modification_requested, pending_leave_type_id, pending_start_date, pending_end_date, pending_hours, pending_time_ranges, pending_notes, profiles!user_id(full_name, email), leave_types(name, color)')
          .order('created_at', { ascending: false }),
        admin.from('leave_types').select('id, name, color'),
      ])
      if (error) {
        console.error('[admin] leave_requests error:', error)
        adminError = error.message
      } else {
        const ltMap = new Map(
          ((ltData ?? []) as { id: string; name: string; color: string }[]).map(lt => [lt.id, { name: lt.name, color: lt.color }])
        )
        requests = ((data as unknown as LeaveRequest[]) ?? []).map(r => ({
          ...r,
          pending_leave_type: r.pending_leave_type_id ? (ltMap.get(r.pending_leave_type_id) ?? null) : null,
        }))
      }
    }

    if (activeTab === 'collaboratori') {
      const { data: usersData, error: usersError } = await admin
        .from('profiles')
        .select('id, full_name, role, is_active, company, team, job_title, hire_date, end_date, notes, annual_riposi_days, annual_permessi_days, email')
        .order('full_name', { ascending: true })
      if (usersError) {
        console.error('[admin] profiles error:', usersError)
        adminError = usersError.message
      } else if (usersData) {
        const userIds = usersData.map((u: any) => u.id)
        const { data: leaveReqs } = await admin
          .from('leave_requests')
          .select('id, user_id, start_date, end_date, hours, status, notes, admin_notes, admin_modified, leave_type_id, leave_types(name, color)')
          .in('user_id', userIds)
          .order('start_date', { ascending: false })
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
          .select('id, start_date, end_date, hours, user_id, status, leave_types(name, color)')
          .in('status', ['approved', 'pending'])
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
    <div className="min-h-dvh bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-4 sm:px-6 h-14 flex items-center gap-3 sticky top-0 z-10">
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

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {adminError && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            Errore di configurazione: {adminError}
          </div>
        )}

        {/* Tabs + bulk action */}
        <div className="flex flex-wrap items-center gap-3 mb-8">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-fit overflow-x-auto">
          <a
            href="/admin?tab=richieste"
            className={`flex shrink-0 items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
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
            className={`flex shrink-0 items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
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
            className={`flex shrink-0 items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === 'presenze'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            Presenze
          </a>
        </div>
        <AdminBulkAssignButton />
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
