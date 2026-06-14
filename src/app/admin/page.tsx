import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminRichieste from '@/components/AdminRichieste'

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: requests } = await supabase
    .from('leave_requests')
    .select('id, start_date, end_date, status, notes, created_at, profiles(full_name, email), leave_types(name, color)')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-blue-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <a href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</a>
        <span className="text-gray-300">|</span>
        <h1 className="text-lg font-bold text-gray-900">Gestione Richieste</h1>
      </nav>
      <main className="max-w-5xl mx-auto px-6 py-10">
        <AdminRichieste requests={requests ?? []} />
      </main>
    </div>
  )
}
