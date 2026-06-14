'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, SunHorizon } from '@/components/icons'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email o password non corretti.')
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://work-apps-portal.vercel.app'

  return (
    <div className="min-h-dvh flex bg-gray-50">
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-slate-800 to-slate-900 items-center justify-center p-12">
        <div className="max-w-sm text-white">
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mb-8">
            <SunHorizon className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold mb-4 leading-tight">Comunicazioni Assenze</h2>
          <p className="text-slate-300 text-base leading-relaxed">
            Comunica le tue assenze, monitora lo stato e tieni traccia delle conferme.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center mb-5 lg:hidden">
              <SunHorizon className="w-5 h-5 text-slate-700" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Accedi</h1>
            <p className="text-gray-500 mt-1 text-sm">Comunicazioni Assenze — inserisci le tue credenziali</p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500 transition-colors"
                placeholder="nome@azienda.it"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500 transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full bg-slate-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-slate-800 active:bg-slate-950 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Accesso in corso...' : 'Accedi'}
            </button>
          </form>

          <div className="mt-8 text-center">
            <a
              href={portalUrl}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Torna al portale
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
