'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { XMark } from '@/components/icons'

export type UserProfile = {
  id: string
  email: string
  full_name: string | null
  role: string
  is_active: boolean
  company: string | null
  team: string | null
  job_title: string | null
  hire_date: string | null
  end_date: string | null
  notes: string | null
  annual_leave_days: number
}

export default function AdminEditUser({
  user,
  onClose,
}: {
  user: UserProfile
  onClose: () => void
}) {
  const router = useRouter()
  const [form, setForm] = useState({
    full_name:         user.full_name         ?? '',
    email:             user.email,
    password:          '',
    company:           user.company           ?? '',
    team:              user.team              ?? '',
    job_title:         user.job_title         ?? '',
    hire_date:         user.hire_date         ?? '',
    end_date:          user.end_date          ?? '',
    notes:             user.notes             ?? '',
    annual_leave_days: String(user.annual_leave_days ?? 20),
    role:              user.role,
    is_active:         user.is_active,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const body: Record<string, unknown> = {
      userId:            user.id,
      full_name:         form.full_name,
      company:           form.company,
      team:              form.team,
      job_title:         form.job_title,
      hire_date:         form.hire_date || null,
      end_date:          form.end_date  || null,
      notes:             form.notes,
      annual_leave_days: parseInt(form.annual_leave_days) || 20,
      role:              form.role,
      is_active:         form.is_active,
    }
    if (form.email !== user.email) body.email = form.email
    if (form.password) body.password = form.password

    const res = await fetch('/api/admin/update-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error ?? 'Errore durante il salvataggio')
    } else {
      router.refresh()
      onClose()
    }
  }

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500 transition-colors bg-white'
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide'

  const monthlyRate = (parseInt(form.annual_leave_days) / 12).toFixed(2)
  const weeklyRate  = (parseInt(form.annual_leave_days) / 52).toFixed(2)
  const JOB_TITLES  = ['Tecnico', 'Sviluppatore', 'Designer', 'Responsabile di team', 'Direzione', 'Commerciale', 'Amministrazione', 'Consulente']

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-semibold text-gray-900">Modifica collaboratore</h3>
            <p className="text-xs text-gray-400 mt-0.5">{user.email}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <XMark className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {/* Dati personali */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Dati personali</p>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className={labelCls}>Nome completo</label>
                <input type="text" value={form.full_name} onChange={e => set('full_name', e.target.value)} className={inputCls} placeholder="Mario Rossi" />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Nuova password <span className="normal-case font-normal">(lascia vuoto per non cambiare)</span></label>
                <input type="password" value={form.password} onChange={e => set('password', e.target.value)} className={inputCls} placeholder="••••••••" minLength={6} />
              </div>
            </div>
          </div>

          {/* Dati lavorativi */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Dati lavorativi</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Azienda</label>
                <input type="text" value={form.company} onChange={e => set('company', e.target.value)} className={inputCls} placeholder="Es. XYZ Srl" />
              </div>
              <div>
                <label className={labelCls}>Team</label>
                <input type="text" value={form.team} onChange={e => set('team', e.target.value)} className={inputCls} placeholder="Es. Sviluppo" />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Ruolo professionale</label>
                <input
                  type="text"
                  list="job-titles-ferie"
                  value={form.job_title}
                  onChange={e => set('job_title', e.target.value)}
                  className={inputCls}
                  placeholder="Es. Tecnico, Responsabile di team..."
                />
                <datalist id="job-titles-ferie">
                  {JOB_TITLES.map(t => <option key={t} value={t} />)}
                </datalist>
              </div>
              <div>
                <label className={labelCls}>Inizio collaborazione</label>
                <input type="date" value={form.hire_date} onChange={e => set('hire_date', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Fine collaborazione</label>
                <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} className={inputCls} min={form.hire_date || undefined} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Giorni di assenza / anno</label>
                <input
                  type="number"
                  min="0"
                  max="365"
                  value={form.annual_leave_days}
                  onChange={e => set('annual_leave_days', e.target.value)}
                  className={inputCls}
                />
                {parseInt(form.annual_leave_days) > 0 && (
                  <p className="text-xs text-gray-400 mt-2 bg-gray-50 rounded-lg px-3 py-2">
                    Maturazione: <span className="font-medium text-gray-600">{monthlyRate} gg/mese</span> · <span className="font-medium text-gray-600">{weeklyRate} gg/settimana</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Note */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Note</p>
            <textarea
              rows={3}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              className={`${inputCls} resize-none`}
              placeholder="Informazioni aggiuntive sul collaboratore..."
            />
          </div>

          {/* Ruolo e stato */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Accesso</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Ruolo</label>
                <select value={form.role} onChange={e => set('role', e.target.value)} className={inputCls}>
                  <option value="user">Collaboratore</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex flex-col justify-end pb-0.5">
                <label className={labelCls}>Stato account</label>
                <button
                  type="button"
                  onClick={() => set('is_active', !form.is_active)}
                  className={`flex items-center gap-2 text-sm font-medium px-3 py-2.5 rounded-xl border transition-colors ${form.is_active ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
                >
                  <span className={`w-2 h-2 rounded-full ${form.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                  {form.is_active ? 'Attivo' : 'Disattivato'}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>
          )}

          <div className="flex gap-3 pt-1 pb-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors">
              Annulla
            </button>
            <button type="submit" disabled={loading} className="flex-1 bg-slate-900 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50">
              {loading ? 'Salvataggio...' : 'Salva modifiche'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
