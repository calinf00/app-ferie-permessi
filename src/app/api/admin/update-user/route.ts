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
  const { userId, email, password, full_name, company, team, hire_date, annual_leave_days, role, is_active } = body

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Update auth (email/password) if provided
  const authUpdates: Record<string, string> = {}
  if (email) authUpdates.email = email
  if (password) authUpdates.password = password

  if (Object.keys(authUpdates).length > 0) {
    const { error } = await adminClient.auth.admin.updateUserById(userId, authUpdates)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Update profile fields
  const profileUpdates: Record<string, unknown> = {}
  if (full_name !== undefined) profileUpdates.full_name = full_name
  if (email !== undefined) profileUpdates.email = email
  if (company !== undefined) profileUpdates.company = company
  if (team !== undefined) profileUpdates.team = team
  if (hire_date !== undefined) profileUpdates.hire_date = hire_date || null
  if (annual_leave_days !== undefined) profileUpdates.annual_leave_days = Number(annual_leave_days)
  if (role !== undefined) profileUpdates.role = role
  if (is_active !== undefined) profileUpdates.is_active = is_active

  if (Object.keys(profileUpdates).length > 0) {
    const { error } = await adminClient.from('profiles').update(profileUpdates).eq('id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
