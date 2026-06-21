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

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const body = await request.json()
  const { userId, email, password, full_name, company, team, job_title, hire_date, end_date, notes, annual_riposi_days, annual_permessi_days, role, is_active } = body

  if (!userId) {
    return NextResponse.json({ error: 'userId mancante' }, { status: 400 })
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    console.error('[update-user] SUPABASE_SERVICE_ROLE_KEY non configurata nelle variabili di ambiente')
    return NextResponse.json(
      { error: 'Configurazione del server incompleta (service role key mancante)' },
      { status: 500 }
    )
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  )

  // Update auth (email/password/display name) if provided
  const authUpdates: { email?: string; password?: string; user_metadata?: Record<string, unknown> } = {}
  if (email) authUpdates.email = email
  if (password) authUpdates.password = password
  if (full_name !== undefined) authUpdates.user_metadata = { full_name, display_name: full_name }

  if (Object.keys(authUpdates).length > 0) {
    const { error } = await adminClient.auth.admin.updateUserById(userId, authUpdates)
    if (error) {
      console.error('[update-user] auth update fallito:', error.message)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
  }

  // Update profile fields
  const profileUpdates: Record<string, unknown> = {}
  if (full_name !== undefined) profileUpdates.full_name = full_name
  if (email !== undefined) profileUpdates.email = email
  if (company           !== undefined) profileUpdates.company           = company    || null
  if (team              !== undefined) profileUpdates.team              = team       || null
  if (job_title         !== undefined) profileUpdates.job_title         = job_title  || null
  if (hire_date         !== undefined) profileUpdates.hire_date         = hire_date  || null
  if (end_date          !== undefined) profileUpdates.end_date          = end_date   || null
  if (notes             !== undefined) profileUpdates.notes             = notes      || null
  if (annual_riposi_days   !== undefined) profileUpdates.annual_riposi_days   = Number(annual_riposi_days)
  if (annual_permessi_days !== undefined) profileUpdates.annual_permessi_days = Number(annual_permessi_days)
  if (role !== undefined) profileUpdates.role = role
  if (is_active !== undefined) profileUpdates.is_active = is_active

  if (Object.keys(profileUpdates).length > 0) {
    const { error } = await adminClient.from('profiles').update(profileUpdates).eq('id', userId)
    if (error) {
      console.error('[update-user] profile update fallito:', error.message, profileUpdates)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
  }

  return NextResponse.json({ success: true })
}
