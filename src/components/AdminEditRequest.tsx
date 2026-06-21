'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { XMark } from '@/components/icons'
import OrarioPermesso, { emptyOrario, orarioToRanges, rangesToOrario, orarioHours, type OrarioValue } from '@/components/OrarioPermesso'
import { type TimeRanges } from '@/lib/leave-utils'

type LeaveType = { id: string; name: string; color: string }

export type RequestToEdit = {
  id: string
  start_date: string
  end_date: string
  hours: number | null
  time_ranges?: TimeRanges | null
  status: string
  notes: string | null
  admin_notes: string | null
  leave_types: { name: string; color: string } | null
  profiles: { full_name: string | null; email: string } | null
}

export default function AdminEditRequest({
  request,
  onClose,
}: {
  request: RequestToEdit
  onClose: () => void
}) {
  const supabase = createClient()
  const router = useRouter()

  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [orario, setOrario] = useState<OrarioValue>(rangesToOrario(request.time_ranges))
  const [form, setForm] = useState({
    leave_type_id: '',
    isPartial: !!request.hours,
    start_date: request.start_date,
    end_date: request.end_date,
    status: request.status,
    admin_notes: request.admin_notes ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('leave_types')
      .select('id, name, color')
      .then(({ data }) => {
        if (!data) return
        setLeaveTypes(data)
        const current = data.find(lt => lt.name === request.leave_types?.name)
        setForm(f => ({ ...f, leave_type_id: current?.id ?? data[0]?.id ?? '' }))
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.isPartial && orarioHours(orario) <= 0) {
      setError('Inserisci almeno una fascia oraria valida (mattina o pomeriggio).')
      return
    }
    setLoading(true)
    setError('')

    const res = await fetch('/api/admin/update-leave-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: request.id,
        start_date: form.start_date,
        end_date: form.isPartial ? form.start_date : form.end_date,
        hours: form.isPartial ? orarioHours(orario) : null,
        time_ranges: form.isPartial ? orarioToRanges(orario) : null,
        leave_type_id: form.leave_type_id,
        status: form.status,
        admin_notes: form.admin_notes || null,
      }),
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

  const name = request.profiles?.full_name || request.profiles?.email || 'Utente'
  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500 transition-colors bg-white'
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide'

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-semibold text-gray-900">Modifica comunicazione</h3>
            <p className="text-xs text-gray-400 mt-0.5">{name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <XMark className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {/* Leave type */}
          <div>
            <label className={labelCls}>Tipo di assenza</label>
            <select
              value={form.leave_type_id}
              onChange={e => set('leave_type_id', e.target.value)}
              className={inputCls}
            >
              {leaveTypes.map(lt => (
                <option key={lt.id} value={lt.id}>{lt.name}</option>
              ))}
            </select>
          </div>

          {/* Mode toggle */}
          <div>
            <label className={labelCls}>Modalità</label>
            <div className="flex gap-0.5 bg-gray-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => set('isPartial', false)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${!form.isPartial ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Giornata intera
              </button>
              <button
                type="button"
                onClick={() => set('isPartial', true)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${form.isPartial ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Seleziona ore
              </button>
            </div>
          </div>

          {/* Dates / hours */}
          {form.isPartial ? (
            <div className="flex flex-col gap-3">
              <div>
                <label className={labelCls}>Data</label>
                <input
                  type="date"
                  required
                  value={form.start_date}
                  onChange={e => set('start_date', e.target.value)}
                  className={inputCls}
                />
              </div>
              <OrarioPermesso value={orario} onChange={setOrario} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Data inizio</label>
                <input
                  type="date"
                  required
                  value={form.start_date}
                  onChange={e => set('start_date', e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Data fine</label>
                <input
                  type="date"
                  required
                  value={form.end_date}
                  onChange={e => set('end_date', e.target.value)}
                  min={form.start_date}
                  className={inputCls}
                />
              </div>
            </div>
          )}

          {/* Status */}
          <div>
            <label className={labelCls}>Stato</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
              <option value="pending">In attesa</option>
              <option value="approved">Confermata</option>
              <option value="rejected">Non confermata</option>
            </select>
          </div>

          {/* Admin notes visible to user */}
          <div>
            <label className={labelCls}>
              Nota per il collaboratore{' '}
              <span className="normal-case font-normal text-gray-400">(visibile all&apos;utente)</span>
            </label>
            <textarea
              rows={3}
              value={form.admin_notes}
              onChange={e => set('admin_notes', e.target.value)}
              placeholder="Es. Date modificate per sovrapposizione con un altro collega…"
              className={`${inputCls} resize-none`}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>
          )}

          <div className="flex gap-3 pt-1 pb-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading || !form.leave_type_id}
              className="flex-1 bg-slate-900 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {loading ? 'Salvataggio…' : 'Salva modifiche'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
