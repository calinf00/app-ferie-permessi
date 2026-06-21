import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
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

  const body = await request.json()
  const { requestId, leave_type_id, start_date, end_date, hours, notes } = body

  if (!requestId || !leave_type_id || !start_date || !end_date) {
    return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 })
  }

  // Verifica proprietà e stato (RLS consente la lettura delle proprie comunicazioni)
  const { data: existing, error: readErr } = await supabase
    .from('leave_requests')
    .select('id, user_id, status')
    .eq('id', requestId)
    .single()

  if (readErr || !existing) return NextResponse.json({ error: 'Comunicazione non trovata' }, { status: 404 })
  if (existing.user_id !== user.id) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  if (existing.status !== 'approved') {
    return NextResponse.json({ error: 'Solo le comunicazioni confermate possono essere modificate' }, { status: 400 })
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    console.error('[request-modification] SUPABASE_SERVICE_ROLE_KEY non configurata')
    return NextResponse.json({ error: 'Configurazione del server incompleta' }, { status: 500 })
  }
  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)

  const { error } = await admin
    .from('leave_requests')
    .update({
      modification_requested: true,
      pending_leave_type_id: leave_type_id,
      pending_start_date: start_date,
      pending_end_date: end_date,
      pending_hours: hours ?? null,
      pending_notes: notes || null,
    })
    .eq('id', requestId)

  if (error) {
    console.error('[request-modification]', error.message)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
