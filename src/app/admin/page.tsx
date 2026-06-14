import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminRichieste, { type LeaveRequest } from '@/components/AdminRichieste'
import AdminCollaboratori, { type UserWithRequests } from '@/components/AdminCollaboratori'
import { DocumentText, UsersGroup, ArrowLeft } from '@/components/icons'

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const activeTab = tab === 'collaboratori' ? 'collaboratori' : 'richieste'

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const [requestsRes, usersRes] = await Promise.all([
    activeTab === 'richieste'
      ? supabase
          .from('leave_requests')
          .select('id, start_date, end_date, status, notes, created_at, profiles(full_name, email), leave_types(name, color)')
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: null }),

    activeTab === 'collaboratori'
      ? supabase
          .from('profiles')
          .select('id, full_name, role, is_active, company, team, hire_date, annual_leave_days, email')
          .order('full_name', { ascending: true })
      : Promise.resolve({ data: null }),
  ])

  let usersWithRequests: UserWithRequests[] = []
  if (activeTab === 'collaboratori' && usersRes.data) {
    const userIds = usersRes.data.map((u: any) => u.id)
    const { data: leaveReqs } = await supabase
      .from('leave_requests')
      .select('user_id, start_date, end_date, status')
      .in('user_id', userIds)
      .eq('status', 'approved')

    usersWithRequests = usersRes.data.map((u: any) => ({
      ...u,
      leave_requests: (leaveReqs ?? []).filter((r: any) => r.user_id === u.id),
    }))
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
            Richieste
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
        </div>

        {activeTab === 'richieste' && (
          <AdminRichieste requests={(requestsRes.data as unknown as LeaveRequest[]) ?? []} />
        )}

        {activeTab === 'collaboratori' && (
          <AdminCollaboratori users={usersWithRequests} />
        )}
      </main>
    </div>
  )
}
