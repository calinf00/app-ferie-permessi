import { createServerClient } from '@supabase/ssr'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) return NextResponse.json({ error: 'Configurazione server incompleta' }, { status: 500 })

  const body = await request.json()
  const { userIds, leave_type_id, start_date, end_date, hours, status, admin_notes } = body

  if (!userIds?.length || !leave_type_id || !start_date || !end_date) {
    return NextResponse.json({ error: 'Campi obbligatori mancanti' }, { status: 400 })
  }

  const adminClient = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)

  // Find users who already have an overlapping absence in that period
  const { data: existing } = await adminClient
    .from('leave_requests')
    .select('user_id')
    .in('user_id', userIds)
    .lte('start_date', end_date)
    .gte('end_date', start_date)
    .neq('status', 'rejected')

  const skippedIds = new Set((existing ?? []).map((r: any) => r.user_id))
  const eligibleIds = userIds.filter((id: string) => !skippedIds.has(id))

  if (eligibleIds.length === 0) {
    return NextResponse.json({ created: 0, skipped: userIds.length, skippedIds: [...skippedIds] })
  }

  const now = new Date().toISOString()
  const rows = eligibleIds.map((userId: string) => ({
    user_id: userId,
    leave_type_id,
    start_date,
    end_date,
    hours: hours ?? null,
    status: status ?? 'approved',
    notes: null,
    admin_notes: admin_notes ?? null,
    admin_modified: true,
    admin_modified_at: now,
  }))

  const { error } = await adminClient.from('leave_requests').insert(rows)
  if (error) {
    console.error('[bulk-create-leave-requests]', error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({
    created: eligibleIds.length,
    skipped: skippedIds.size,
    skippedIds: [...skippedIds],
  })
}
