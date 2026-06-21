import { createServerClient } from '@supabase/ssr'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const body = await request.json()
  const { requestId, start_date, end_date, hours, time_ranges, leave_type_id, status, admin_notes } = body

  if (!requestId) return NextResponse.json({ error: 'requestId mancante' }, { status: 400 })

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'Configurazione server incompleta' }, { status: 500 })
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  )

  const updates: Record<string, unknown> = {
    admin_modified: true,
    admin_modified_at: new Date().toISOString(),
    admin_notes: admin_notes ?? null,
  }
  if (start_date)         updates.start_date    = start_date
  if (end_date)           updates.end_date      = end_date
  if (hours !== undefined)       updates.hours        = hours
  if (time_ranges !== undefined) updates.time_ranges  = time_ranges
  if (leave_type_id)      updates.leave_type_id = leave_type_id
  if (status)             updates.status        = status

  const { error } = await adminClient
    .from('leave_requests')
    .update(updates)
    .eq('id', requestId)

  if (error) {
    console.error('[update-leave-request]', error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
